import { getOandaCandles, getOandaLatest } from "./oanda.functions";
import {
  OANDA_DESCRIPTIONS,
  OANDA_INSTRUMENTS,
  toGranularity,
  type Bar,
  type OandaInstrument,
} from "./oanda-shared";

type Range = { from?: number; to?: number; limit?: number };

function instrumentOf(ticker: string): OandaInstrument {
  const symbol = ticker.toUpperCase().replace(/[_/]/g, "");
  const instrument = OANDA_INSTRUMENTS.find((candidate) => candidate.replace("_", "") === symbol);
  if (!instrument) {
    throw new Error(`OANDA does not serve ${ticker}`);
  }
  return instrument;
}
function granularityOf(tf: string) {
  const g = toGranularity(tf);
  if (!g) throw new Error(`OANDA supports 5m, 15m, 1h, 4h and 1D only (got ${tf})`);
  return g;
}

/** Vela data provider for OANDA practice candles, proxied through server functions. */
export class OandaProvider {
  info() {
    return {
      name: "oanda",
      displayName: "OANDA",
      supportedTimeframes: ["5", "15", "60", "240", "1D"] as const,
      capabilities: { enumerate: true, stream: true, symbolInfo: true },
    };
  }

  async listSymbols() {
    return OANDA_INSTRUMENTS.map((ticker) => ({
      ticker: ticker.replace("_", ""),
      description: OANDA_DESCRIPTIONS[ticker],
      type: ticker === "XAU_USD" ? "commodity" : "forex",
    }));
  }

  async getSymbolInfo(ticker: string) {
    const t = instrumentOf(ticker);
    return {
      ticker: t.replace("_", ""),
      description: OANDA_DESCRIPTIONS[t],
      type: t === "XAU_USD" ? "commodity" : "forex",
      currency: t.split("_")[1],
      timezone: "Etc/UTC",
    };
  }

  async getBars(ticker: string, timeframe: string, range: Range): Promise<Bar[]> {
    const res = await getOandaCandles({
      data: {
        instrument: instrumentOf(ticker),
        granularity: granularityOf(timeframe),
        ...(range.from != null && { from: range.from }),
        ...(range.to != null && { to: range.to }),
        ...(range.limit != null && { limit: Math.min(range.limit, 20000) }),
      },
    });
    if (!res.ok) throw new Error(res.message);
    return res.bars;
  }

  subscribe(ticker: string, timeframe: string, onBar: (bar: Bar) => void) {
    const instrument = instrumentOf(ticker);
    const granularity = granularityOf(timeframe);
    let stopped = false;
    let last = 0;
    const tick = async () => {
      try {
        const res = await getOandaLatest({ data: { instrument, granularity } });
        if (stopped || !res.ok) return;
        for (const b of res.bars) if (b.time >= last) {
          last = b.time;
          onBar(b);
        }
      } catch {
        /* Next poll retries. */
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }
}
