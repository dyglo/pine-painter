import { getNativeIndicator, sharedBarStore, registerWidgetAction } from "@luxalgo/vela";
import { VelaWorkspace } from "@luxalgo/vela/workspace";
import { PineEngine } from "@luxalgo/vela-pinets";
import type { DataProvider, InputValue, VelaTheme } from "@luxalgo/vela";
import { asOfSeries, createDataset, intervalOf, WARMUP_BARS, type ReplayDataset } from "./dataset";
import { ReplayBarrier, ReplayEngine } from "./engine";
import {
  ReplaySession,
  restoreReplay,
  saveReplay,
  REPLAY_STORAGE_KEY,
  type ReplayView,
  type SavedReplay,
} from "./session";
import { ENGINE_VERSIONS, REPLAY_VERIFIED } from "./versions";
import { ManagedHandles, MANAGED_PREFIX } from "./managed-handle";

import { simulate, type TradingTape, type TradingState, type OrderInput } from "./trading";

type Script = SavedReplay["scripts"][number];
export type ReplayHostView = {
  ready: boolean;
  loading: boolean;
  dataset: ReplayDataset | null;
  view: ReplayView | null;
  error: string;
  saved: boolean;
  selecting?: boolean;
  selectionTime?: number | null;
  tradeOpen?: boolean;
  trading?: TradingState | null;
};
export type ReplayHost = ReturnType<typeof createReplayHost>;
const scriptsOf = (ws: VelaWorkspace): Script[] =>
  ws.chart
    .indicators()
    .filter((h) => h.source)
    .map((h) => ({
      id: h.id,
      source: h.source!,
      inputs: h.inputValues(),
      props: h.propValues(),
      visible: h.visible,
    }));

export function createReplayHost(
  element: HTMLElement,
  theme: VelaTheme,
  providers: Record<string, () => DataProvider>,
  changed: (state: ReplayHostView) => void,
) {
  let ws: VelaWorkspace;
  let layer: HTMLDivElement;
  let session: ReplaySession | null = null;
  let disposed = false;
  let tradingTape: TradingTape | null = null;
  const idleWaiters = new Set<() => void>();
  let operation = 0;
  const hostId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  let state: ReplayHostView = {
    ready: false,
    loading: false,
    dataset: null,
    view: null,
    error: "",
    saved: false,
  };
  let liveIdentity = { symbol: "BTCUSDT", timeframe: "60" };
  let liveScripts: Script[] = [];
  let scriptSequence = 0;
  const managed = new ManagedHandles(() => ws.chart.indicators());
  let liveChart: unknown;
  let seekQueue: Promise<unknown> = Promise.resolve();
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const emit = (next: Partial<ReplayHostView>) => {
    if (!disposed) {
      state = { ...state, ...next };
      changed({ ...state });
      for (const button of element.querySelectorAll<HTMLButtonElement>(
        ".vela-widget-action-left",
      )) {
        if (button.textContent === "Replay")
          button.setAttribute("aria-pressed", String(!!state.dataset || !!state.selecting));
      }
      if (!state.loading) {
        for (const resolve of idleWaiters) resolve();
        idleWaiters.clear();
      }
    }
  };
  const newLayer = () => {
    const node = document.createElement("div");
    node.className = "absolute inset-0";
    node.style.visibility = "hidden";
    element.append(node);
    return node;
  };
  function persist() {
    if (!session || !state.dataset || state.loading || state.view?.status === "calculating") return;
    try {
      saveReplay(localStorage, {
        schema: 1,
        dataset: state.dataset,
        versions: ENGINE_VERSIONS,
        cursor: session.view.cursor,
        speed: session.view.speed,
        chartState: snapshot(ws),
        scripts: scriptsOf(ws),
        ...(tradingTape ? { trading: tradingTape } : {}),
      });
      emit({ saved: true });
    } catch {
      emit({ error: "Browser storage is unavailable or full. This session cannot be restored." });
    }
  }
  function snapshot(target: VelaWorkspace) {
    return {
      renderer: target.chart.renderer.getConfig(),
      drawings: target.chart.drawings.getConfig(),
      visibleRange: target.chart.getVisibleRange(),
      natives: target.chart
        .indicators()
        .filter((h) => h.nativeType && h.nativeType !== "volume")
        .map((h) => ({ type: h.nativeType!, inputs: h.inputValues(), visible: h.visible })),
    };
  }
  async function applySnapshot(target: VelaWorkspace, data: unknown, replaying: boolean) {
    if (!data || typeof data !== "object") return;
    const saved = data as {
      renderer?: unknown;
      drawings?: unknown;
      visibleRange?: { from: number; to: number };
      natives?: { type: string; inputs: Record<string, InputValue>; visible: boolean }[];
    };
    if (saved.renderer) target.chart.renderer.applyConfig(saved.renderer);
    target.chart.renderer.set("priceStyle", "candles");
    if (saved.drawings) target.chart.drawings.applyConfig(saved.drawings);
    for (const native of saved.natives ?? []) {
      if (replaying && getNativeIndicator(native.type)?.reactsToViewport)
        throw new Error("Viewport-dependent native studies are unavailable in replay.");
      const handle = target.chart.addNativeIndicator(native.type, { inputs: native.inputs });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Native indicator calculation timed out.")),
          15000,
        );
        handle.on("ready", () => {
          clearTimeout(timeout);
          handle.setVisible(native.visible);
          resolve();
        });
        handle.on("error", ({ error }) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }
    const range = saved.visibleRange;
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to))
      target.chart.setVisibleRange(range);
  }
  async function mount(
    dataset: ReplayDataset | null,
    cursor: number,
    scripts: Script[],
    chartState: unknown,
  ) {
    if (disposed) throw new Error("Chart workspace was disposed.");
    const epoch = ++operation;
    const node = newLayer();
    const barrier = new ReplayBarrier();
    const closeTime = dataset ? dataset.bars[cursor]!.time + dataset.interval : 0;
    // A unique provider namespace per analytical state avoids the library's shared
    // cache entirely, including drawing/native paths that bypass engine fetchSeries.
    const namespace = `replay_${hostId}_${epoch}`;
    const symbol = dataset?.symbol.split(":").at(-1) ?? "";
    const replayProvider: DataProvider | null = dataset
      ? {
          info: () => ({
            name: namespace,
            displayName: "Replay",
            capabilities: { enumerate: true, symbolInfo: true, stream: false },
          }),
          listSymbols: async () => [
            {
              ticker: symbol,
              description: dataset.symbol,
              type: "replay",
              prefix: dataset.symbol.split(":")[0]!.toUpperCase(),
            },
          ],
          getSymbolInfo: async () => structuredClone(dataset.symbolInfo),
          getBars: async (ticker, timeframe, range) => {
            if (epoch !== operation || disposed) throw new Error("Replay data request superseded.");
            const bars = asOfSeries(dataset, ticker, timeframe, closeTime).filter(
              (b) =>
                (range.from == null || b.time >= range.from) &&
                (range.to == null || b.time <= range.to),
            );
            return range.limit == null ? bars : bars.slice(-range.limit);
          },
          subscribe: () => () => {},
        }
      : null;
    const target = new VelaWorkspace(node, {
      layout: false,
      theme,
      symbol: dataset ? `${namespace}:${symbol}` : liveIdentity.symbol,
      timeframe: dataset?.timeframe ?? liveIdentity.timeframe,
      live: !dataset,
      topbar: {
        left: ["symbol", "timeframes", "style", "indicators", "actions", "undo-redo"],
        right: ["actions", "panels", "screenshot"],
      },
      ...(dataset
        ? {
            data: dataset.bars.map((b) => ({ ...b })),
            priceStyle: "candles",
            topbar: {
              left: ["indicators", "actions", "undo-redo"],
              right: ["actions", "panels", "screenshot"],
            },
          }
        : {}),
      providers: replayProvider ? { [namespace]: () => replayProvider } : providers,
      engines: {
        pine: () =>
          dataset
            ? new ReplayEngine(
                new PineEngine(),
                () => ({ dataset, closeTime, generation: epoch }),
                barrier,
              )
            : new PineEngine(),
      },
    });
    try {
      await target.chart.ready();
      if (disposed || epoch !== operation) throw new Error("Replay transition superseded.");
      if (dataset && cursor < dataset.bars.length - 1)
        await target.replay.start({ from: dataset.bars[cursor]!.time });
      // At the final candle all of the immutable bounded tape is legitimately
      // revealed. live:false and the non-streaming provider keep it frozen.
      await applySnapshot(target, chartState, !!dataset);
      if (dataset && !state.dataset) {
        const lastOpen = dataset.bars[cursor]!.time;
        const visible = target.chart.getVisibleRange();
        if (visible)
          target.chart.setVisibleRange({
            from: Math.min(visible.from, lastOpen - dataset.interval * 20),
            to: lastOpen + dataset.interval * 5,
          });
      }
      for (const script of scripts) {
        const result = await target.chart.runIndicator(script.source, {
          language: "pine",
          id: script.id,
          inputs: script.inputs as Record<string, InputValue>,
          props: script.props as Record<string, InputValue>,
        });
        if (!result.ok) throw result.error ?? new Error("Replay indicator did not complete.");
        result.handle?.setVisible(script.visible);
      }
      await barrier.settled();
      if (disposed || epoch !== operation) throw new Error("Replay transition superseded.");
      const old = ws;
      const oldLayer = layer;
      ws = target;
      layer = node;
      node.style.visibility = "visible";
      old?.destroy();
      oldLayer?.remove();
      // Deplyze has one chart. Retire cache namespaces belonging to previous
      // analytical states; current candles remain owned by this native workspace.
      // This bounds memory without sharing future data with any new state.
      if (dataset) sharedBarStore.clear();
      target.chart.renderer.onCrosshairMove((event) => {
        if (state.selecting && !state.loading) emit({ selectionTime: event.time });
      });
      target.chart.renderer.onClick((event) => {
        if (!state.selecting || state.loading || event.time == null) return;
        const time = event.time;
        if (state.dataset) {
          const cursor = state.dataset.bars.findIndex((b) => b.time === time);
          if (cursor < state.dataset.warmup || cursor > (state.view?.cursor ?? -1)) {
            emit({ error: "Choose a revealed candle after the warm-up range." });
            return;
          }
          emit({ selecting: false, selectionTime: null });
          void session?.seek(cursor);
        } else {
          emit({ selecting: false, selectionTime: null });
          void api.enter(time + intervalOf(target.chart.market.timeframe ?? "60"));
        }
      });
      target.on("state:changed", () => {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persist, 600);
      });
      return;
    } catch (e) {
      barrier.invalidate();
      target.destroy();
      node.remove();
      throw e;
    }
  }
  function selectBar() {
    if (state.loading) return;
    session?.pause();
    emit({ selecting: !state.selecting, selectionTime: null });
  }
  const unregisterReplay = registerWidgetAction({
    id: `deplyze-replay-${hostId}`,
    target: "topbar",
    align: "left",
    label: "Replay",
    run: selectBar,
  });
  const unregisterTrade = registerWidgetAction({
    id: `deplyze-trade-${hostId}`,
    target: "topbar",
    align: "right",
    label: "Trade",
    run: () => emit({ tradeOpen: !state.tradeOpen }),
  });
  const firstMount = mount(null, 0, [], null)
    .then(() => {
      let saved = false;
      try {
        saved = !!localStorage.getItem(REPLAY_STORAGE_KEY);
      } catch {
        /* storage optional */
      }
      emit({ ready: true, saved });
    })
    .catch((e: unknown) => emit({ error: e instanceof Error ? e.message : String(e) }));
  seekQueue = firstMount;

  async function startDataset(
    dataset: ReplayDataset,
    cursor: number,
    scripts: Script[],
    chartState: unknown,
    speed = 1,
    restoredTrading?: TradingTape,
  ) {
    session?.dispose();
    tradingTape = restoredTrading ?? { version: 1, start: cursor, actions: [] };
    simulate(dataset, tradingTape, cursor);
    emit({ loading: true, error: "", selecting: false });
    let initial = true;
    session = new ReplaySession(
      dataset,
      {
        seek: async (next) => {
          emit({ loading: true });
          const task = seekQueue.then(() =>
            mount(
              dataset,
              next,
              initial ? scripts : scriptsOf(ws),
              initial ? chartState : snapshot(ws),
            ),
          );
          seekQueue = task.catch(() => {});
          try {
            await task;
            if (tradingTape) {
              // Rewinding forks the action history; future decisions are discarded.
              tradingTape = {
                ...tradingTape,
                start: Math.min(tradingTape.start, next),
                actions: tradingTape.actions.filter((a) => a.cursor <= next),
              };
              emit({ trading: simulate(dataset, tradingTape, next) });
            }
            initial = false;
          } finally {
            emit({ loading: false });
          }
        },
      },
      cursor,
      (view) => {
        if (!initial) {
          emit({ dataset, view });
          if (view.status !== "calculating") persist();
        }
      },
    );
    session.setSpeed(speed);
    await session.seek(cursor);
    if (session.view.status === "error") {
      const error = session.view.error;
      session.dispose();
      session = null;
      emit({ loading: false, dataset: null, view: null, error });
      return;
    }
    emit({ loading: false, dataset, view: { ...session.view } });
    persist();
  }
  const api = {
    selectBar,
    toggleTrade: () => emit({ tradeOpen: !state.tradeOpen }),
    trade(order: OrderInput | "close" | "cancel") {
      if (
        !state.dataset ||
        !session ||
        !tradingTape ||
        state.loading ||
        !["paused", "ended"].includes(session.view.status) ||
        (session.view.status === "ended" && order !== "cancel")
      )
        return;
      try {
        const next = {
          ...tradingTape,
          actions: [...tradingTape.actions, { cursor: session.view.cursor, order }],
        };
        const trading = simulate(state.dataset, next, session.view.cursor);
        tradingTape = next;
        emit({ trading, error: "" });
        persist();
      } catch (error) {
        emit({ error: error instanceof Error ? error.message : String(error) });
      }
    },
    async enter(selectedClose: number) {
      if (!REPLAY_VERIFIED) {
        emit({
          error: "Replay disabled: these engine versions have not passed the correctness suite.",
        });
        return;
      }
      if (state.loading || session) return;
      emit({ loading: true, error: "" });
      try {
        await seekQueue;
        const market = ws.chart.market;
        const resolved = ws.chart.data.resolve(market.symbol ?? "");
        if (!resolved) throw new Error("Choose an available market first.");
        const provider = ws.chart.data.providerInstance(resolved.provider);
        if (!provider) throw new Error("Historical provider is unavailable.");
        const interval = intervalOf(market.timeframe ?? "60");
        if (resolved.provider === "oanda" && interval > 3600000)
          throw new Error(
            "OANDA replay currently supports 5m, 15m and 1h. Longer source candles need verified session/DST close metadata.",
          );
        if (!Number.isFinite(selectedClose) || selectedClose > Date.now() || selectedClose < 0)
          throw new Error("Select a historical closed-candle time.");
        const from = selectedClose - interval * (WARMUP_BARS * 3 + 1);
        const to = Math.min(
          selectedClose + interval * 500,
          Math.floor(Date.now() / interval) * interval,
        );
        const bars = await provider.getBars(resolved.ticker, market.timeframe ?? "60", {
          from,
          to,
          limit: 5000,
        });
        if (disposed) return;
        const symbolInfo = await provider.getSymbolInfo?.(resolved.ticker);
        const dataset = await createDataset({
          symbol: `${resolved.provider}:${resolved.ticker}`,
          timeframe: market.timeframe ?? "60",
          from,
          to,
          bars,
          now: Date.now(),
          ...(symbolInfo ? { symbolInfo } : {}),
        });
        const cursor = dataset.bars.filter((b) => b.time + interval <= selectedClose).length - 1;
        if (cursor < dataset.warmup)
          throw new Error(
            "The selected date has fewer than 200 warm-up candles. Choose a later candle.",
          );
        liveIdentity = { symbol: dataset.symbol, timeframe: dataset.timeframe };
        await seekQueue;
        liveScripts = scriptsOf(ws);
        liveChart = snapshot(ws);
        await startDataset(dataset, cursor, liveScripts, {
          ...(liveChart as object),
        });
      } catch (e) {
        emit({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    async restore() {
      if (state.loading || session || !REPLAY_VERIFIED) return;
      emit({ loading: true, error: "" });
      try {
        const saved = await restoreReplay(
          localStorage.getItem(REPLAY_STORAGE_KEY) ?? "null",
          ENGINE_VERSIONS,
        );
        await seekQueue;
        liveIdentity = { symbol: saved.dataset.symbol, timeframe: saved.dataset.timeframe };
        await seekQueue;
        liveScripts = scriptsOf(ws);
        liveChart = snapshot(ws);
        await startDataset(
          saved.dataset,
          saved.cursor,
          saved.scripts,
          saved.chartState,
          saved.speed,
          saved.trading,
        );
      } catch (e) {
        emit({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    async exit() {
      if (!session || state.loading) return;
      session.pause();
      emit({ loading: true });
      try {
        await seekQueue;
        const currentScripts = scriptsOf(ws);
        session.dispose();
        session = null;
        await mount(null, 0, currentScripts, liveChart);
        tradingTape = null;
        emit({
          dataset: null,
          view: null,
          trading: null,
          selecting: false,
          loading: false,
          error: "",
        });
      } catch (e) {
        emit({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    next: () => session?.next(),
    previous: () => session?.previous(),
    seek: (cursor: number) => session?.seek(cursor),
    play: () => session?.play(),
    pause: () => session?.pause(),
    speed: (value: number) => session?.setSpeed(value),
    async compile(code: string) {
      session?.pause();
      if (state.loading) await new Promise<void>((resolve) => idleWaiters.add(resolve));
      if (disposed)
        return { ok: false, handle: null, error: new Error("Chart workspace was disposed.") };
      const task = seekQueue.then(async () => {
        const target = ws;
        const result = await target.chart.runIndicator(code, {
          language: "pine",
          id: `${MANAGED_PREFIX}${hostId}-${++scriptSequence}`,
        });
        if (disposed || target !== ws) {
          result.handle?.remove();
          return { ok: false, handle: null, error: new Error("Chart changed during compilation.") };
        }
        if (result.ok) {
          clearTimeout(persistTimer);
          persistTimer = setTimeout(persist, 100);
        }
        return { ...result, handle: result.handle ? managed.candidate(result.handle.id) : null };
      });
      // Let the unchanged indicator runner commit/cancel its returned candidate
      // before a seek snapshots handles. Promise resolution alone is one microtask
      // too early and can resurrect a retired or cancelled indicator.
      seekQueue = task.then(
        () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
        () => {},
      );
      return task;
    },
    dispose() {
      disposed = true;
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
      ++operation;
      session?.dispose();
      clearTimeout(persistTimer);
      unregisterReplay();
      unregisterTrade();
      ws?.destroy();
      element.replaceChildren();
    },
  };
  return api;
}
