// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createDataset } from "@/lib/replay/dataset";
import { simulate, type TradingTape } from "@/lib/replay/trading";
import { fitStage, shiftedStyle, viewportStyle, orderRisk } from "@/components/chart-design/layout";
const time = Date.UTC(2026, 0, 1),
  interval = 60000;
const bars = Array.from({ length: 12 }, (_, i) => ({
  time: time + i * interval,
  open: 100,
  high: 105,
  low: 95,
  close: 101,
  volume: 10,
}));
const fixture = () =>
  createDataset({
    symbol: "test:X",
    timeframe: "1",
    from: time,
    to: time + 12 * interval,
    now: time + 12 * interval,
    bars,
    warmup: 2,
  });
describe("HTML layout migration", () => {
  it("fills the viewport without letterboxing and anchors the lower controls", () => {
    expect(fitStage(1366, 768)).toEqual({
      scale: 0.5,
      left: 0,
      top: 0,
      extraWidth: 313,
      extraHeight: 96,
    });
    const f = fitStage(1132, 950);
    expect(f.scale).toBe(0.5);
    expect(fitStage(1920, 1080).scale).toBe(f.scale);
    expect(f.left).toBe(0);
    expect(f.top).toBe(0);
    expect((1512 + f.extraHeight - 72) * f.scale).toBeCloseTo(950);
    expect(
      viewportStyle({ left: 107, top: 80, width: 2218, height: 1352 }, -100, 600),
    ).toMatchObject({ left: 107, top: 80, width: 1618, height: 1252 });
    expect(viewportStyle({ left: 2377, top: 1105 }, 96, 600, 313)).toMatchObject({
      left: 2690,
      top: 851,
    });
    expect(viewportStyle({ left: 2060, top: 8 }, -100, 600)).toMatchObject({ left: 1460, top: 8 });
  });
  it("ports exact panel/replay shifts rather than introducing responsive breakpoints", () => {
    expect(
      shiftedStyle({ left: 107, top: 80, width: 1625, height: 1352 }, false, false).width,
    ).toBe(2218);
    expect(shiftedStyle({ left: 901, top: 1316 }, false, true).left).toBe(1197.5);
    expect(shiftedStyle({ left: 1673, top: 1241 }, false, false)).toMatchObject({
      left: 2266,
      top: 1335,
    });
    expect(shiftedStyle({ left: 901, top: 1316 }, true, true).left).toBe(901);
  });
  it("keeps source risk sizing and R:R arithmetic", () => {
    expect(orderRisk(231.23, 230.07, 233.54, 10)).toEqual({
      risk: expect.closeTo(11.6),
      reward: expect.closeTo(23.1),
      ratio: "1.99",
    });
    expect(orderRisk(100, 0, 110, 1).ratio).toBe("–");
    expect(Math.max(1, Math.floor(100 / Math.abs(231.23 - 230.07)))).toBe(86);
  });
});
describe("HTML order controls connected to replay execution", () => {
  it("amends protection after the closed candle, never retroactively", async () => {
    const d = await fixture();
    const t: TradingTape = {
      version: 2,
      start: 2,
      actions: [
        {
          cursor: 2,
          order: { side: "buy", type: "market", quantity: 1, stopLoss: 90, takeProfit: 120 },
        },
        { cursor: 3, order: { amend: { stopLoss: 99, takeProfit: 115 } } },
      ],
    };
    const now = simulate(d, t, 3);
    expect(now.position?.stopLoss).toBe(99);
    expect(now.fills).toHaveLength(1);
    expect(simulate(d, t, 4).fills[1]?.reason).toMatch(/Stop loss/);
    expect(() =>
      simulate(
        d,
        { ...t, actions: [...t.actions, { cursor: 3, order: { amend: { stopLoss: 110 } } }] },
        4,
      ),
    ).toThrow(/protective/);
  });
  it("defers stop-limit limit execution until the trigger candle is closed", async () => {
    const d = await fixture();
    const t: TradingTape = {
      version: 2,
      start: 2,
      actions: [
        {
          cursor: 2,
          order: { side: "buy", type: "stop-limit", quantity: 1, price: 104, limitPrice: 103 },
        },
      ],
    };
    expect(simulate(d, t, 3).fills).toHaveLength(0);
    expect(simulate(d, t, 4).fills[0]).toMatchObject({ cursor: 4, reason: "stop-limit entry" });
    expect(simulate(d, t, 4).fills[0]!.price).toBeLessThanOrEqual(103);
    const changed = {
      ...d,
      bars: d.bars.map((b, i) =>
        i > 4 ? { ...b, open: 1000, high: 1100, low: 900, close: 1001 } : b,
      ),
    };
    expect(simulate(d, t, 4)).toEqual(simulate(changed, t, 4));
    expect(simulate(d, t, 4)).toEqual(
      simulate({ ...d, bars: d.bars.slice(0, 5) }, JSON.parse(JSON.stringify(t)), 4),
    );
  });
  it("does not fill a triggered stop-limit after a gap above its limit", async () => {
    const d = await fixture(),
      gap = {
        ...d,
        bars: d.bars.map((b, i) =>
          i >= 4 ? { ...b, open: 120, high: 125, low: 115, close: 121 } : b,
        ),
      };
    const t: TradingTape = {
      version: 2,
      start: 2,
      actions: [
        {
          cursor: 2,
          order: { side: "buy", type: "stop-limit", quantity: 1, price: 104, limitPrice: 103 },
        },
      ],
    };
    expect(simulate(gap, t, 5).fills).toHaveLength(0);
    expect(simulate(gap, t, 5).pending).not.toBeNull();
  });
});
