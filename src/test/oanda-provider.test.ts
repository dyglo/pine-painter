import { describe, expect, it, vi } from "vitest";
import { OandaProvider } from "@/lib/oanda/oanda-provider";
import { getOandaCandles } from "@/lib/oanda/oanda.functions";

vi.mock("@/lib/oanda/oanda.functions", () => ({
  getOandaCandles: vi.fn(async () => ({ ok: true, bars: [] })),
  getOandaLatest: vi.fn(async () => ({ ok: true, bars: [] })),
}));

describe("OANDA display symbols", () => {
  const provider = new OandaProvider();

  it("lists compact forex and gold symbols", async () => {
    expect((await provider.listSymbols()).map((symbol) => symbol.ticker)).toEqual([
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCAD",
      "XAUUSD",
    ]);
    expect(await provider.getSymbolInfo("XAUUSD")).toMatchObject({
      ticker: "XAUUSD",
      type: "commodity",
      currency: "USD",
    });
  });

  it.each(["EURUSD", "EUR_USD", "eur/usd"])(
    "requests OANDA's API identifier for %s",
    async (ticker) => {
      await provider.getBars(ticker, "60", { limit: 100 });
      expect(getOandaCandles).toHaveBeenLastCalledWith({
        data: { instrument: "EUR_USD", granularity: "H1", limit: 100 },
      });
      expect((await provider.getSymbolInfo(ticker)).ticker).toBe("EURUSD");
    },
  );

  it("maps compact gold symbols to OANDA's gold identifier", async () => {
    await provider.getBars("XAUUSD", "60", {});
    expect(getOandaCandles).toHaveBeenLastCalledWith({
      data: { instrument: "XAU_USD", granularity: "H1" },
    });
  });
});
