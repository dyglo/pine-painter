import { getNativeIndicator, sharedBarStore } from "@luxalgo/vela";
import { VelaWorkspace } from "@luxalgo/vela/workspace";
import { PineEngine } from "@luxalgo/vela-pinets";
import type {
  DataProvider,
  InputValue,
  VelaTheme,
  OHLCV,
  DrawingTypeKey,
  VisibleRangePreset,
} from "@luxalgo/vela";
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

import {
  simulate,
  type TradingTape,
  type TradingState,
  type OrderInput,
  type TradingAction,
} from "./trading";

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
  market?: {
    symbol: string;
    timeframe: string;
    description: string;
    quote: string;
    tick: number;
    bar: OHLCV | null;
  };
  crosshairPrice?: number | null;
  drawingTool?: string | null;
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
  let positionDrawing: string | null = null;
  const overlayIds = new Set<string>();
  const protectionIds = new Map<string, "stopLoss" | "takeProfit">();
  let uiScale = 0.5;
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
  function syncPosition() {
    if (!ws) return;
    for (const id of overlayIds) ws.chart.drawings.remove(id);
    overlayIds.clear();
    protectionIds.clear();
    positionDrawing = null;
    const dataset = state.dataset;
    if (!dataset || !state.view) return;
    const remember = (doc: ReturnType<typeof ws.chart.drawings.add>, locked = false) => {
      if (doc) {
        overlayIds.add(doc.id);
        if (locked) ws.chart.drawings.lock(doc.id, true);
      }
      return doc;
    };
    for (const fill of state.trading?.fills ?? []) {
      if (fill.reason.endsWith("entry")) continue;
      remember(
        ws.chart.drawings.add("pricelabel", {
          anchors: [{ time: dataset.bars[fill.cursor]!.time, price: fill.price }],
          style: { lineColor: fill.reason.startsWith("Stop") ? "#f23645" : "#089981" },
          text: {
            value: `${fill.reason.startsWith("Stop") ? "SL" : fill.reason.startsWith("Take") ? "TP" : "Closed"} @ ${fill.price}`,
            size: "normal",
            hAlign: "left",
            vAlign: "top",
          },
        }),
        true,
      );
    }
    const p = state.trading?.position;
    if (!p) return;
    const lastEntry = state.trading?.fills
      .slice()
      .reverse()
      .find((f) => f.reason.endsWith("entry"));
    const time = dataset.bars[lastEntry?.cursor ?? state.view.cursor]!.time;
    for (const [key, price] of [
      ["entry", p.entry],
      ["stopLoss", p.stopLoss],
      ["takeProfit", p.takeProfit],
    ] as const) {
      if (price == null) continue;
      const doc = remember(
        ws.chart.drawings.add("hline", {
          anchors: [{ time, price }],
          style: {
            lineColor: key === "entry" ? "#2962ff" : key === "stopLoss" ? "#f23645" : "#089981",
            lineWidth: 2,
            lineStyle: "solid",
          },
          text: {
            value:
              key === "entry"
                ? `${p.side === "buy" ? "Long" : "Short"} ${p.quantity} · ${state.trading?.unrealized.toFixed(2)}`
                : `${key === "stopLoss" ? "SL" : "TP"} ${price}`,
            size: "normal",
            hAlign: "right",
            vAlign: "top",
          },
        }),
        key === "entry",
      );
      if (doc && key !== "entry") protectionIds.set(doc.id, key);
    }
    if (p.stopLoss == null || p.takeProfit == null) return;
    const doc = remember(
      ws.chart.drawings.add("position", {
        anchors: [
          { time, price: p.entry },
          { time: time + dataset.interval * 20, price: p.stopLoss },
          { time: time + dataset.interval * 20, price: p.takeProfit },
        ],
        props: {
          quantity: p.quantity,
          showPrices: true,
          showHeader: true,
          profitColor: "#089981",
          lossColor: "#f23645",
        },
      }),
    );
    positionDrawing = doc?.id ?? null;
  }
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
      drawings: {
        ...target.chart.drawings.toJSON(),
        drawings: target.chart.drawings.all().filter((d) => !overlayIds.has(d.id)),
      },
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
      drawingToolbar: false,
      statusline: false,
      watermark: false,
      bottombar: false,
      layoutMode: "desktop",
      theme,
      symbol: dataset ? `${namespace}:${symbol}` : liveIdentity.symbol,
      timeframe: dataset?.timeframe ?? liveIdentity.timeframe,
      live: !dataset,
      topbar: {
        left: ["symbol", "timeframes", "style", "indicators", "undo-redo"],
        right: ["panels", "screenshot"],
      },
      ...(dataset
        ? {
            data: dataset.bars.map((b) => ({ ...b })),
            priceStyle: "candles",
            topbar: {
              left: ["indicators", "undo-redo"],
              right: ["panels", "screenshot"],
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
      target.chart.renderer.applyConfig({
        layout: {
          background: "#fff",
          textColor: "#131722",
          fontFamily: '-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,Ubuntu,sans-serif',
          fontSize: 26 * uiScale,
        },
        grid: { vertLines: { color: "#f4f6fa" }, horzLines: { color: "#f4f6fa" } },
        crosshair: { color: "#b2b5be", width: 2, labelBackground: "#131722" },
      });
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
      const info =
        dataset?.symbolInfo ??
        (await target.chart.data.symbolInfo(target.chart.market.symbol ?? ""));
      const readout = target.chart.renderer.dataWindowReadout();
      const numberOf = (value: string | undefined) => Number((value ?? "").replaceAll(",", ""));
      const initialBar = dataset
        ? dataset.bars[cursor]!
        : readout?.ohlc
          ? {
              time: Date.parse(`${readout.date}T${readout.time}:00Z`),
              open: numberOf(readout.ohlc.o),
              high: numberOf(readout.ohlc.h),
              low: numberOf(readout.ohlc.l),
              close: numberOf(readout.ohlc.c),
              volume: 0,
            }
          : null;
      let market = {
        symbol:
          dataset?.symbol ??
          target.chart.data.canonicalSymbol(target.chart.market.symbol ?? "") ??
          target.chart.market.symbol ??
          "BTCUSDT",
        timeframe: dataset?.timeframe ?? target.chart.market.timeframe ?? "60",
        description: String(info?.["description"] ?? ""),
        quote: String(info?.["currency"] ?? "USD"),
        tick: Number(info?.["mintick"] ?? 0.01),
        bar: initialBar,
      };
      emit({ market });
      target.chart.on("bar", (bar) => {
        if (target === ws && !dataset) {
          market = { ...market, bar };
          emit({ market });
        }
      });
      const refreshMarket = async () => {
        if (target !== ws || dataset) return;
        const symbol = target.chart.market.symbol ?? "BTCUSDT",
          timeframe = target.chart.market.timeframe ?? "60";
        const readout = target.chart.renderer.dataWindowReadout();
        const nextInfo = await target.chart.data.symbolInfo(symbol).catch(() => undefined);
        if (
          disposed ||
          target !== ws ||
          symbol !== target.chart.market.symbol ||
          timeframe !== target.chart.market.timeframe
        )
          return;
        liveIdentity = { symbol, timeframe };
        market = {
          symbol: target.chart.data.canonicalSymbol(symbol) ?? symbol,
          timeframe,
          description: String(nextInfo?.["description"] ?? ""),
          quote: String(nextInfo?.["currency"] ?? "USD"),
          tick: Number(nextInfo?.["mintick"] ?? 0.01),
          bar: readout?.ohlc
            ? {
                time: Date.parse(`${readout.date}T${readout.time}:00Z`),
                open: numberOf(readout.ohlc.o),
                high: numberOf(readout.ohlc.h),
                low: numberOf(readout.ohlc.l),
                close: numberOf(readout.ohlc.c),
                volume: 0,
              }
            : null,
        };
        emit({ market });
      };
      target.chart.on("market:changed", () => {
        void refreshMarket();
      });
      target.chart.on("load:end", () => {
        void refreshMarket();
      });
      target.chart.on("drawing:tool", ({ type }) => emit({ drawingTool: type }));
      target.chart.on("drawing:edited", ({ id }) => {
        if (!state.trading?.position || state.loading) return;
        if (session?.view.status !== "paused") {
          syncPosition();
          return;
        }
        const doc = target.chart.drawings.all().find((d) => d.id === id);
        const protection = protectionIds.get(id);
        if (protection && doc?.anchors[0]) {
          const p = state.trading.position;
          api.trade({
            amend: {
              stopLoss: p.stopLoss,
              takeProfit: p.takeProfit,
              [protection]: doc.anchors[0].price,
            },
          });
        } else if (id === positionDrawing) {
          const stopLoss = doc?.anchors[1]?.price,
            takeProfit = doc?.anchors[2]?.price;
          if (stopLoss != null && takeProfit != null)
            api.trade({ amend: { stopLoss, takeProfit } });
        }
      });
      target.chart.renderer.onCrosshairMove((event) => {
        if (target !== ws || state.loading) return;
        emit({ crosshairPrice: event.price });
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
    if (!state.selecting) ws.chart.drawings.setTool(null);
    emit({ selecting: !state.selecting, selectionTime: null });
  }
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
    tradingTape = restoredTrading ?? { version: 2, start: cursor, actions: [] };
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
          if (view.status !== "calculating") syncPosition();
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
    syncPosition();
    persist();
  }
  const api = {
    selectBar,
    tools(type: DrawingTypeKey | null) {
      if (!state.loading) {
        emit({ selecting: false });
        ws.chart.drawings.setTool(type);
      }
    },
    drawHorizontal(price: number) {
      if (!state.loading && Number.isFinite(price))
        ws.chart.drawings.add("hline", {
          anchors: [{ time: state.market?.bar?.time ?? Date.now(), price }],
        });
    },
    clearDrawings() {
      ws.chart.drawings.removeMany(
        ws.chart.drawings
          .all()
          .filter((d) => !overlayIds.has(d.id))
          .map((d) => d.id),
      );
    },
    undo: () => ws.active.history.undo(),
    redo: () => ws.active.history.redo(),
    range: (preset: VisibleRangePreset) => ws.chart.setVisibleRangePreset(preset),
    mode: (mode: "measure" | null) => ws.chart.drawings.setMode(mode),
    snap: () =>
      ws.chart.drawings.setSnapMode(ws.chart.drawings.getSnapMode() === "off" ? "strong" : "off"),
    nativeControl(label: string) {
      const button = [...element.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) =>
          b.title === label ||
          b.getAttribute("aria-label")?.startsWith(label) ||
          b.textContent?.trim() === label,
      );
      button?.click();
    },
    search: () => {
      if (!session) ws.context().openSymbolSearch();
    },
    timeframe: (tf: string) => {
      if (!session) ws.context().setTimeframe(tf);
    },
    screenshot: () => ws.downloadScreenshot(),
    settings: () => ws.chart.renderer.openSettings(),
    scaleUi(value: number) {
      uiScale = value;
      if (ws) ws.chart.renderer.applyConfig({ layout: { fontSize: 26 * uiScale } });
    },
    rangeDays(days: number) {
      const to =
        (state.market?.bar?.time ?? Date.now()) + intervalOf(state.market?.timeframe ?? "60");
      ws.chart.setVisibleRange({ from: to - days * 86400000, to });
    },
    setView: (range: { from: number; to: number }) => ws.chart.setVisibleRange(range),
    drawings: () => ws.chart.drawings.all(),
    toggleTrade: () => emit({ tradeOpen: !state.tradeOpen }),
    trade(order: TradingAction["order"]) {
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
          actions: [
            ...tradingTape.actions,
            { cursor: session.view.cursor, order: structuredClone(order) },
          ],
        };
        const trading = simulate(state.dataset, next, session.view.cursor);
        tradingTape = next;
        emit({ trading, error: "" });
        syncPosition();
        persist();
      } catch (error) {
        emit({ error: error instanceof Error ? error.message : String(error) });
        syncPosition();
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
      ws?.destroy();
      element.replaceChildren();
    },
  };
  return api;
}
