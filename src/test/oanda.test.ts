import { describe, expect, it } from "vitest";
import { pageWindows, toBar, toGranularity } from "@/lib/oanda/oanda-shared";

describe("oanda helpers", () => {
  it("maps timeframes", () => {
    expect(toGranularity("5")).toBe("M5");
    expect(toGranularity("15")).toBe("M15");
    expect(toGranularity("60")).toBe("H1");
    expect(toGranularity("240")).toBe("H4");
    expect(toGranularity("1D")).toBe("D");
    expect(toGranularity("1")).toBeUndefined();
  });
  it("converts candles", () => {
    expect(
      toBar({
        time: "2026-01-01T00:00:00.000000000Z",
        volume: 10,
        complete: true,
        mid: { o: "1.1", h: "1.2", l: "1.0", c: "1.15" },
      }),
    ).toEqual({ time: Date.parse("2026-01-01T00:00:00Z"), open: 1.1, high: 1.2, low: 1, close: 1.15, volume: 10 });
  });
  it("pages at 5000 candles", () => {
    const w = pageWindows(0, 12000, 1, 5000);
    expect(w).toEqual([
      { from: 0, to: 5000 },
      { from: 5000, to: 10000 },
      { from: 10000, to: 12000 },
    ]);
  });
});
