export const OANDA_INSTRUMENTS = ["EUR_USD", "GBP_USD", "USD_JPY", "USD_CAD", "XAU_USD"] as const;
export const OANDA_GRANULARITIES = ["M5", "M15", "H1", "H4", "D"] as const;
export type OandaInstrument = (typeof OANDA_INSTRUMENTS)[number];
export type OandaGranularity = (typeof OANDA_GRANULARITIES)[number];

export const OANDA_DESCRIPTIONS: Record<OandaInstrument, string> = {
  EUR_USD: "Euro / US Dollar",
  GBP_USD: "British Pound / US Dollar",
  USD_JPY: "US Dollar / Japanese Yen",
  USD_CAD: "US Dollar / Canadian Dollar",
  XAU_USD: "Gold / US Dollar",
};

export const GRANULARITY_MS: Record<OandaGranularity, number> = {
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D: 24 * 60 * 60_000,
};

/** Map a Vela timeframe id to an OANDA granularity (undefined if unsupported). */
export function toGranularity(tf: string): OandaGranularity | undefined {
  const t = tf.trim().toUpperCase();
  const map: Record<string, OandaGranularity> = {
    "5": "M5",
    M5: "M5",
    "15": "M15",
    M15: "M15",
    "60": "H1",
    "1H": "H1",
    H1: "H1",
    "240": "H4",
    "4H": "H4",
    H4: "H4",
    D: "D",
    "1D": "D",
    "1440": "D",
  };
  return map[t];
}

export type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

type RawCandle = {
  time: string;
  volume: number;
  complete: boolean;
  mid?: { o: string; h: string; l: string; c: string };
};

export function toBar(c: RawCandle): Bar | null {
  if (!c.mid) return null;
  const t = Date.parse(c.time);
  if (!Number.isFinite(t)) return null;
  return {
    time: t,
    open: Number(c.mid.o),
    high: Number(c.mid.h),
    low: Number(c.mid.l),
    close: Number(c.mid.c),
    volume: c.volume ?? 0,
  };
}

/** Split [from, to] into windows each holding at most `max` candles. */
export function pageWindows(from: number, to: number, stepMs: number, max = 5000) {
  const out: { from: number; to: number }[] = [];
  const span = stepMs * max;
  for (let s = from; s < to; s += span) out.push({ from: s, to: Math.min(to, s + span) });
  return out;
}
