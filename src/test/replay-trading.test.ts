// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDataset, type ReplayDataset } from "@/lib/replay/dataset";
import { simulate, type TradingTape, type OrderInput } from "@/lib/replay/trading";
const start = Date.UTC(2026, 0, 1),
  interval = 60000;
const bars = Array.from({ length: 12 }, (_, i) => ({
  time: start + i * interval,
  open: 100,
  high: 110,
  low: 90,
  close: 101,
  volume: 100,
}));
const fixture = (data = bars) =>
  createDataset({
    symbol: "test:X",
    timeframe: "1",
    from: start,
    to: start + 12 * interval,
    now: start + 12 * interval,
    bars: data,
    warmup: 2,
  });
const tape = (order: OrderInput): TradingTape => ({
  version: 1,
  start: 2,
  actions: [{ cursor: 2, order }],
});
const market: OrderInput = { side: "buy", type: "market", quantity: 2 };
describe("deterministic replay paper trading", () => {
  it("does not fill on submission candle; market fills next open with disclosed costs", async () => {
    const d = await fixture(),
      t = tape(market);
    expect(simulate(d, t, 2).fills).toEqual([]);
    const s = simulate(d, t, 3);
    expect(s.position?.entry).toBeCloseTo(100.02);
    expect(s.fees).toBeCloseTo(0.020004);
    expect(s.realized).toBeCloseTo(-s.fees);
  });
  it("matches clean prefix-only results and is invariant to future suffix changes", async () => {
    const d = await fixture(),
      t = tape(market);
    const changed = await fixture(
      bars.map((b, i) => (i > 5 ? { ...b, open: 1000, high: 1100, low: 900, close: 1001 } : b)),
    );
    const clean = { ...d, bars: d.bars.slice(0, 6) } as ReplayDataset;
    expect(simulate(d, t, 5)).toEqual(simulate(changed, t, 5));
    expect(simulate(d, t, 5)).toEqual(simulate(clean, t, 5));
    expect(simulate(d, t, 5)).toEqual(simulate(d, t, 5));
  });
  it("uses adverse-first stops and never credits ambiguous entry-bar take profit", async () => {
    const d = await fixture();
    const s = simulate(d, tape({ ...market, stopLoss: 95, takeProfit: 105 }), 3);
    expect(s.position).toBeNull();
    expect(s.fills[1]?.reason).toMatch(/Stop loss/);
    const tp = simulate(d, tape({ ...market, takeProfit: 105 }), 3);
    expect(tp.position).not.toBeNull();
    expect(simulate(d, tape({ ...market, takeProfit: 105 }), 4).fills[1]?.price).toBe(105);
  });
  it("fills limit and stop orders correctly through gaps, for both sides", async () => {
    const d = await fixture(
      bars.map((b, i) => (i === 3 ? { ...b, open: 120, high: 125, low: 115, close: 120 } : b)),
    );
    expect(
      simulate(d, tape({ ...market, type: "stop", price: 105 }), 3).fills[0]?.price,
    ).toBeCloseTo(120.024);
    expect(simulate(d, tape({ ...market, type: "limit", price: 95 }), 3).fills).toHaveLength(0);
    expect(
      simulate(d, tape({ ...market, side: "sell", type: "limit", price: 105 }), 3).fills[0]?.price,
    ).toBeCloseTo(119.976);
    expect(
      simulate(d, tape({ ...market, side: "sell", type: "stop", price: 95 }), 4).fills[0]?.price,
    ).toBeCloseTo(94.981);
  });
  it("supports cancellation, closing, and reconstructs persisted action history", async () => {
    const d = await fixture();
    const t = tape(market);
    t.actions.push({ cursor: 3, order: "close" });
    const s = simulate(d, t, 4);
    expect(s.position).toBeNull();
    expect(s.fills).toHaveLength(2);
    expect(simulate(d, JSON.parse(JSON.stringify(t)), 4)).toEqual(s);
    const canceled = tape(market);
    canceled.actions.push({ cursor: 2, order: "cancel" });
    expect(simulate(d, canceled, 5).fills).toHaveLength(0);
  });
  it("records exposed missing intervals and rejects invalid or future actions", async () => {
    const d = await fixture(bars.filter((_, i) => i !== 3));
    expect(simulate(d, tape(market), 3).gaps).toBe(1);
    expect(() => simulate(d, tape({ ...market, quantity: NaN }), 3)).toThrow();
    expect(() => simulate(d, tape({ ...market, stopLoss: 110 }), 3)).toThrow();
    const future = tape(market);
    future.actions.push({ cursor: 5, order: "close" });
    expect(() => simulate(d, future, 4)).toThrow(/clock/);
    const duplicate = tape(market);
    duplicate.actions.push({ cursor: 2, order: market });
    expect(() => simulate(d, duplicate, 4)).toThrow(/Only one/);
  });
});
