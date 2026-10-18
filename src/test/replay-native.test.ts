import { expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { Vela, type IChartRenderer, type OHLCV, type IndicatorModel } from "@luxalgo/vela";
import { PineEngine } from "@luxalgo/vela-pinets";
import { createDataset } from "@/lib/replay/dataset";
import { ReplayBarrier, ReplayEngine } from "@/lib/replay/engine";

it("native ReplayControl cuts the real engine, suppresses a future suffix and never subscribes on completion", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const start = Date.UTC(2026, 0, 1);
  const bars: OHLCV[] = Array.from({ length: 20 }, (_, i) => ({
    time: start + i * 60000,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 10,
  }));
  const dataset = await createDataset({
    symbol: "test:TEST",
    timeframe: "1",
    from: start,
    to: start + 20 * 60000,
    now: start + 20 * 60000,
    bars,
    warmup: 3,
  });
  let painted: OHLCV[] = [];
  let model: IndicatorModel | undefined;
  const renderer = new Proxy(
    {
      name: "test",
      features: [],
      capabilities: {},
      getVisibleRange: () => null,
      setBars: (value: OHLCV[]) => {
        painted = value;
      },
      updateBar: (bar: OHLCV) => {
        const last = painted.at(-1);
        painted = last?.time === bar.time ? [...painted.slice(0, -1), bar] : [...painted, bar];
      },
      mountIndicator: (value: IndicatorModel) => {
        model = value;
        return { id: value.id };
      },
    },
    { get: (target, key) => (key in target ? Reflect.get(target, key) : () => {}) },
  ) as unknown as IChartRenderer;
  const subscribe = vi.fn(() => () => {});
  const clock = { dataset, closeTime: start + 10 * 60000, generation: 1 };
  const barrier = new ReplayBarrier();
  const chart = new Vela(
    document.createElement("div"),
    { symbol: dataset.symbol, timeframe: "1", data: bars, live: false, volume: false },
    {
      renderer,
      dataFeed: { load: async () => bars, subscribe },
      engines: [new ReplayEngine(new PineEngine(), () => clock, barrier)],
    },
  );
  try {
    await chart.ready();
    await chart.replay.start({ from: bars[9]!.time });
    expect(painted.length).toBe(10);
    const result = await chart.runIndicator('//@version=5\nindicator("Close")\nplot(close)');
    expect(result.ok, result.error?.message).toBe(true);
    await barrier.settled();
    const series = model!.series[0]!;
    expect("points" in series ? series.points.at(-1)?.value : null).toBe(110);
    for (let i = 10; i < bars.length; i++) {
      clock.closeTime = bars[i]!.time + 60000;
      clock.generation++;
      expect(chart.replay.step()).toBe(true);
      await barrier.settled();
    }
    expect(chart.replay.state.active).toBe(false);
    expect(painted).toEqual(bars);
    expect(subscribe).not.toHaveBeenCalled();
    clock.closeTime = bars[5]!.time + 60000;
    clock.generation++;
    // Move the clock before testing calculations on a new seek, as the host does.
    await chart.replay.start({ from: bars[5]!.time });
    await barrier.settled();
    expect(painted.length).toBe(6);
    const line = model!.series[0]!;
    expect("points" in line ? line.points.at(-1)?.value : null).toBe(106);
  } finally {
    chart.destroy();
    vi.unstubAllGlobals();
  }
});
