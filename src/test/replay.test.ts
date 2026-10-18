// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
import { ManagedHandles } from "@/lib/replay/managed-handle";
import { PineEngine } from "@luxalgo/vela-pinets";
import type { ExecutionRequest, IndicatorModel, OHLCV, ScriptingEngine } from "@luxalgo/vela";
import { asOfSeries, createDataset, prefix, type ReplayDataset } from "@/lib/replay/dataset";
import { ReplayBarrier, ReplayEngine } from "@/lib/replay/engine";
import { ReplaySession, restoreReplay, saveReplay, REPLAY_STORAGE_KEY } from "@/lib/replay/session";
import { ENGINE_VERSIONS } from "@/lib/replay/versions";

const minute = 60000;
const start = Date.UTC(2026, 0, 1);
const bars = Array.from({ length: 30 }, (_, i) => ({
  time: start + i * minute,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 10,
}));
const fixture = (data: OHLCV[] = bars) =>
  createDataset({
    symbol: "fixture:TEST",
    timeframe: "1",
    from: start,
    to: start + 30 * minute,
    bars: data,
    now: start + 30 * minute,
    warmup: 3,
  });
const script = `//@version=5\nindicator("Replay oracle", overlay=true)\nplot(ta.ema(close, 3), "EMA")\nplot(ta.atr(3), "ATR")`;
const securityScript = `//@version=5\nindicator("Secondary oracle", overlay=true)\nx = request.security(syminfo.tickerid, "5", ta.sma(close, 2), lookahead=barmerge.lookahead_off)\nplot(x, "HTF")`;
async function evaluate(dataset: ReplayDataset, cursor: number, source: string, guarded = true) {
  const closeTime = dataset.bars[cursor]!.time + minute;
  const barrier = new ReplayBarrier();
  const engine = guarded
    ? new ReplayEngine(new PineEngine(), () => ({ dataset, closeTime, generation: 1 }), barrier)
    : new PineEngine();
  const prepared = await engine.prepare(source, "oracle");
  const req: ExecutionRequest = {
    prepared,
    market: { symbol: dataset.symbol, timeframe: "1", symbolInfo: dataset.symbolInfo },
    mode: "static",
    // Deliberately contaminate the request with future bars; guarded engine must ignore it.
    bars: guarded ? dataset.bars.map((b) => ({ ...b })) : prefix(dataset, closeTime),
    fetchSeries: async (symbol, tf) => asOfSeries(dataset, symbol, tf, closeTime),
  };
  let model: IndicatorModel | undefined;
  await new Promise<void>((resolve, reject) => {
    engine.execute(req, {
      onModel: (value) => {
        model = value;
      },
      onDone: resolve,
      onError: reject,
    });
  });
  await barrier.settled();
  return model;
}

afterEach(() => vi.useRealTimers());
describe("immutable closed-candle datasets", () => {
  it("bounds history, excludes partial candles and records missing intervals without fabrication", async () => {
    const data = await fixture(
      bars
        .filter((_, i) => i !== 8)
        .concat({ ...bars[0]!, time: start - minute }, { ...bars[0]!, time: start + 31 * minute }),
    );
    expect(data.bars.length).toBe(29);
    expect(data.coverage.gaps).toEqual([
      { after: start + 7 * minute, before: start + 9 * minute, missing: 1 },
    ]);
    expect(Object.isFrozen(data.bars[0])).toBe(true);
    const partial = await createDataset({
      symbol: data.symbol,
      timeframe: "1",
      from: start,
      to: start + 30 * minute,
      bars,
      now: start + 10.5 * minute,
      warmup: 3,
    });
    expect(partial.bars.at(-1)!.time).toBe(start + 9 * minute);
    expect(partial.coverage.lastClose).toBe(start + 10 * minute);
  });
  it("rejects overlaps, corrupt prices, unbounded ranges and insufficient warm-up", async () => {
    await expect(fixture([...bars, bars[0]!])).rejects.toThrow("overlap");
    await expect(fixture(bars.map((b, i) => (i === 2 ? { ...b, high: -1 } : b)))).rejects.toThrow(
      "invalid candle",
    );
    await expect(fixture(bars.slice(0, 3))).rejects.toThrow("warm-up");
    await expect(
      createDataset({
        symbol: "TEST",
        timeframe: "1",
        from: start,
        to: start + 5001 * minute,
        bars,
        now: start + 5001 * minute,
      }),
    ).rejects.toThrow("limited");
  });
  it("never exposes incomplete HTF OHLC, or creates a bar from missing constituents", async () => {
    const data = await fixture();
    expect(asOfSeries(data, data.symbol, "5", start + 4 * minute)).toEqual([]);
    expect(asOfSeries(data, data.symbol, "5", start + 5 * minute)).toEqual([
      { time: start, open: 100, high: 106, low: 99, close: 105, volume: 50 },
    ]);
    const gap = await fixture(bars.filter((_, i) => i !== 3));
    expect(asOfSeries(gap, gap.symbol, "5", start + 5 * minute)).toEqual([]);
    expect(() => asOfSeries(data, "OTHER", "5", start + 10 * minute)).toThrow("Cross-symbol");
    expect(() => asOfSeries(data, data.symbol, "1M", start + 10 * minute)).toThrow();
  });
});

describe("real PineTS prefix equivalence and future-suffix invariance", () => {
  it.each([script, securityScript])(
    "matches clean prefix-only runs at every tested cutoff",
    async (source) => {
      const original = await fixture();
      for (const cursor of [9, 12, 14, 19, 24, 29]) {
        const changed = await fixture(
          bars.map((b, i) =>
            i > cursor
              ? {
                  ...b,
                  open: b.open * 100,
                  high: b.high * 100,
                  low: b.low * 100,
                  close: b.close * 100,
                }
              : b,
          ),
        );
        const expected = await evaluate(original, cursor, source, false);
        expect(expected, "A clean run must produce an indicator model").toBeDefined();
        expect(
          expected!.series.some(
            (series) =>
              "points" in series &&
              series.points.some((point) => point.value !== null && Number.isFinite(point.value)),
          ),
          "Oracle must contain real finite values, not an empty/NaN-only success",
        ).toBe(true);
        if (source === securityScript && cursor === 9) {
          const line = expected!.series[0]!;
          expect("points" in line ? line.points.at(-1)?.value : null).toBe(107.5);
        }
        expect(await evaluate(original, cursor, source), `cutoff ${cursor}`).toEqual(expected);
        expect(await evaluate(changed, cursor, source), `suffix changed after ${cursor}`).toEqual(
          expected,
        );
      }
    },
    30000,
  );

  it("fails closed when a real Pine secondary request targets an unsnapshotted symbol", async () => {
    const data = await fixture();
    await expect(
      evaluate(data, 19, securityScript.replace("syminfo.tickerid", '"OTHER"')),
    ).rejects.toThrow("Cross-symbol");
    const values = asOfSeries(data, data.symbol, "5", start + 15 * minute);
    values[0]!.high = 1000000;
    expect(asOfSeries(data, data.symbol, "5", start + 15 * minute)[0]!.high).toBe(106);
  });
  it("rejects deliberate lookahead and nondeterministic scripts", async () => {
    const data = await fixture();
    const engine = new ReplayEngine(
      new PineEngine(),
      () => ({ dataset: data, closeTime: start + 10 * minute, generation: 1 }),
      new ReplayBarrier(),
    );
    await expect(
      engine.prepare(securityScript.replace("lookahead_off", "lookahead_on"), "unsafe"),
    ).rejects.toThrow("unsafe");
    await expect(engine.prepare('indicator("x")\nplot(timenow)', "unsafe")).rejects.toThrow(
      "unsafe",
    );
  });
  it("cannot use a contaminated cache or outbound gateway", async () => {
    const data = await fixture();
    const contaminated = vi.fn(async () => bars);
    const engine = new ReplayEngine(
      new PineEngine(),
      () => ({ dataset: data, closeTime: start + 15 * minute, generation: 1 }),
      new ReplayBarrier(),
    );
    const prepared = await engine.prepare(securityScript, "cache");
    await new Promise<void>((resolve, reject) =>
      engine.execute(
        {
          prepared,
          market: { symbol: data.symbol, timeframe: "1" },
          mode: "static",
          bars,
          fetchSeries: contaminated,
        },
        { onModel: () => {}, onDone: resolve, onError: reject },
      ),
    );
    expect(contaminated).not.toHaveBeenCalled();
  });
  it("suppresses an asynchronous model from an obsolete execution", async () => {
    const data = await fixture();
    const callbacks: { onModel: (model: IndicatorModel) => void; onDone?: () => void }[] = [];
    const base: ScriptingEngine = {
      language: "pine",
      capabilities: { streaming: false, visibleRange: true, inputs: true },
      prepare: async () => ({
        language: "pine",
        inputs: [],
        meta: { title: "race", overlay: true },
        reactsToViewport: false,
        token: {},
      }),
      execute: (_req, handlers) => {
        callbacks.push(handlers);
        return { stop() {}, update() {}, notifyBars() {}, setVisibleRange() {} };
      },
    };
    const clock = { dataset: data, closeTime: start + 10 * minute, generation: 1 };
    const barrier = new ReplayBarrier();
    const engine = new ReplayEngine(base, () => clock, barrier);
    const prepared = await engine.prepare("indicator('race')", "race");
    const onModel = vi.fn();
    const execution = engine.execute(
      { prepared, market: { symbol: data.symbol, timeframe: "1" }, mode: "static", bars },
      { onModel },
    );
    await Promise.resolve();
    clock.generation++;
    clock.closeTime += minute;
    execution.notifyBars();
    await Promise.resolve();
    callbacks[0]!.onModel({} as IndicatorModel);
    callbacks[0]!.onDone?.();
    expect(onModel).not.toHaveBeenCalled();
    callbacks[1]!.onModel({} as IndicatorModel);
    callbacks[1]!.onDone?.();
    await barrier.settled();
    expect(onModel).toHaveBeenCalledOnce();
  });
});

describe("analytical clock, frozen completion and persistence", () => {
  it("serializes seek races and only publishes the most recent completed state", async () => {
    const data = await fixture();
    let resolve!: () => void;
    const calls: number[] = [];
    const session = new ReplaySession(data, {
      seek: async (cursor) => {
        calls.push(cursor);
        if (cursor === 5)
          await new Promise<void>((done) => {
            resolve = done;
          });
      },
    });
    const first = session.seek(5);
    await Promise.resolve();
    const second = session.seek(8);
    resolve();
    await Promise.all([first, second]);
    expect(calls).toEqual([5, 8]);
    expect(session.view.cursor).toBe(8);
    session.dispose();
  });
  it("waits for calculations, pause/resume matches manual stepping, and completion stays frozen", async () => {
    vi.useFakeTimers();
    const data = await fixture(bars.slice(0, 8));
    const calls: number[] = [];
    const session = new ReplaySession(
      data,
      {
        seek: async (cursor) => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          calls.push(cursor);
        },
      },
      3,
    );
    session.play();
    await vi.advanceTimersByTimeAsync(1050);
    expect(session.view.cursor).toBe(3);
    expect(session.view.status).toBe("calculating");
    session.pause();
    await vi.advanceTimersByTimeAsync(200);
    expect(session.view.cursor).toBe(4);
    expect(session.view.status).toBe("paused");
    session.play();
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls).toEqual([4, 5, 6, 7]);
    expect(session.view.status).toBe("ended");
    await vi.advanceTimersByTimeAsync(50000);
    expect(calls).toEqual([4, 5, 6, 7]);
    const manual: number[] = [];
    const reference = new ReplaySession(
      data,
      {
        seek: async (cursor) => {
          manual.push(cursor);
        },
      },
      3,
    );
    for (let i = 0; i < 4; i++) await reference.next();
    expect(calls).toEqual(manual);
    session.dispose();
    reference.dispose();
  });
  it("restores only the verified dataset, engine versions and valid cursor", async () => {
    const data = await fixture();
    let raw = "";
    saveReplay(
      {
        setItem: (key, value) => {
          expect(key).toBe(REPLAY_STORAGE_KEY);
          raw = value;
        },
      },
      {
        schema: 1,
        dataset: data,
        versions: ENGINE_VERSIONS,
        cursor: 12,
        speed: 2,
        chartState: { drawings: [] },
        scripts: [],
      },
    );
    const saved = await restoreReplay(raw, ENGINE_VERSIONS);
    expect(saved.dataset.id).toBe(data.id);
    expect(saved.cursor).toBe(12);
    expect(saved.speed).toBe(2);
    expect(Object.isFrozen(saved.dataset.bars)).toBe(true);
    const corrupted = JSON.parse(raw);
    corrupted.dataset.bars[0].close++;
    await expect(restoreReplay(JSON.stringify(corrupted), ENGINE_VERSIONS)).rejects.toThrow(
      "verification",
    );
    await expect(restoreReplay(raw, { ...ENGINE_VERSIONS, pine: "changed" })).rejects.toThrow(
      "versions",
    );
    const reference = await evaluate(data, saved.cursor, script, false);
    expect(await evaluate(saved.dataset, saved.cursor, script)).toEqual(reference);
  });
});

it("preserves successful indicator replacement and cancellation across workspace restoration", () => {
  let handles = ["deplyze-agent-old", "manual"];
  const tracker = new ManagedHandles(() =>
    handles.map((id) => ({
      id,
      remove: () => {
        handles = handles.filter((h) => h !== id);
      },
    })),
  );
  const old = tracker.candidate("deplyze-agent-old");
  handles = ["deplyze-agent-restored", "manual", "deplyze-agent-new"];
  const cancelled = tracker.candidate("deplyze-agent-new");
  cancelled.remove();
  expect(handles).toEqual(["deplyze-agent-restored", "manual"]);
  handles.push("deplyze-agent-success");
  tracker.candidate("deplyze-agent-success");
  old.remove();
  expect(handles).toEqual(["manual", "deplyze-agent-success"]);
});
