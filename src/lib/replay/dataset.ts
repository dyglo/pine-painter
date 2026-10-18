import type { OHLCV, SymbolInfo } from "@luxalgo/vela";

export const MAX_REPLAY_BARS = 5000;
export const WARMUP_BARS = 200;
export const REPLAY_SCHEMA = 1 as const;
export type EngineVersions = { vela: string; bridge: string; pine: string };
export type ReplayDataset = Readonly<{
  id: string;
  schema: 1;
  symbol: string;
  timeframe: string;
  interval: number;
  requested: Readonly<{ from: number; to: number }>;
  coverage: Readonly<{
    first: number;
    lastClose: number;
    count: number;
    gaps: readonly Readonly<{ after: number; before: number; missing: number }>[];
  }>;
  warmup: number;
  symbolInfo: Readonly<SymbolInfo>;
  bars: readonly Readonly<OHLCV>[];
}>;

// V1 deliberately supports fixed, UTC-aligned time bars only. Calendar months,
// synthetic prices and partial HTF candles cannot silently acquire guessed closes.
export function intervalOf(timeframe: string): number {
  if (timeframe === "1D" || timeframe === "D") return 86400000;
  if (!/^\d+$/.test(timeframe)) throw new Error("Replay requires a fixed time-based resolution.");
  const minutes = Number(timeframe);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440 || 1440 % minutes !== 0)
    throw new Error("This replay resolution is not supported.");
  return minutes * 60000;
}

export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}

export async function createDataset(input: {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  bars: readonly OHLCV[];
  now: number;
  warmup?: number;
  symbolInfo?: SymbolInfo;
}): Promise<ReplayDataset> {
  const interval = intervalOf(input.timeframe);
  if (!Number.isFinite(input.from) || !Number.isFinite(input.to) || input.from >= input.to)
    throw new Error("Invalid replay date range.");
  if ((input.to - input.from) / interval > MAX_REPLAY_BARS)
    throw new Error(`Replay is limited to ${MAX_REPLAY_BARS} candle intervals.`);
  const warmup = input.warmup ?? WARMUP_BARS;
  if (!Number.isSafeInteger(warmup) || warmup < 1 || warmup >= MAX_REPLAY_BARS)
    throw new Error("Invalid warm-up size.");
  const bars = input.bars
    .filter((b) => b.time >= input.from && b.time + interval <= Math.min(input.to, input.now))
    .map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
    }))
    .sort((a, b) => a.time - b.time);
  if (bars.length > MAX_REPLAY_BARS || bars.length <= warmup)
    throw new Error(
      `Not enough closed history: replay requires ${warmup} warm-up candles and a replay candle.`,
    );
  const gaps: { after: number; before: number; missing: number }[] = [];
  bars.forEach((b, i) => {
    if (
      ![b.time, b.open, b.high, b.low, b.close, b.volume].every(Number.isFinite) ||
      b.low > Math.min(b.open, b.close) ||
      b.high < Math.max(b.open, b.close) ||
      b.volume < 0
    )
      throw new Error("Historical data contains an invalid candle.");
    const previous = bars[i - 1];
    if (previous) {
      const distance = b.time - previous.time;
      if (distance < interval || distance % interval !== 0)
        throw new Error("Historical candles overlap or have inconsistent timestamps.");
      if (distance > interval)
        gaps.push({ after: previous.time, before: b.time, missing: distance / interval - 1 });
    }
  });
  const body = {
    schema: REPLAY_SCHEMA,
    symbol: input.symbol,
    timeframe: input.timeframe,
    interval,
    requested: { from: input.from, to: input.to },
    coverage: {
      first: bars[0]!.time,
      lastClose: bars.at(-1)!.time + interval,
      count: bars.length,
      gaps,
    },
    warmup,
    symbolInfo: JSON.parse(
      JSON.stringify({
        ticker: input.symbol.split(":").at(-1) ?? input.symbol,
        tickerid: input.symbol,
        main_tickerid: input.symbol,
        timezone: "Etc/UTC",
        session: "24x7",
        type: "crypto",
        currency: "USD",
        mintick: 0.01,
        pricescale: 100,
        minmove: 1,
        pointvalue: 1,
        ...input.symbolInfo,
      }),
    ) as SymbolInfo,
    bars,
  };
  const id = await digest(body);
  return deepFreeze({
    ...body,
    id,
    requested: Object.freeze(body.requested),
    coverage: Object.freeze({
      ...body.coverage,
      gaps: Object.freeze(gaps.map((g) => Object.freeze(g))),
    }),
    bars: Object.freeze(bars.map((b) => Object.freeze(b))),
  });
}

export function prefix(dataset: ReplayDataset, closeTime: number): OHLCV[] {
  return dataset.bars.filter((b) => b.time + dataset.interval <= closeTime).map((b) => ({ ...b }));
}

// A calculation gateway, not a tape loader: it never uses the live feed or Vela's
// global cache. Returned arrays/objects are fresh, so engine writes cannot taint it.
export function asOfSeries(
  dataset: ReplayDataset,
  symbol: string,
  timeframe: string,
  closeTime: number,
): OHLCV[] {
  if (
    symbol &&
    symbol.toUpperCase() !== dataset.symbol.toUpperCase() &&
    (symbol.includes(":") ||
      symbol.toUpperCase() !== dataset.symbol.split(":").at(-1)?.toUpperCase())
  )
    throw new Error(
      "Cross-symbol requests are unavailable in replay: no immutable dataset for this symbol.",
    );
  const interval = intervalOf(timeframe);
  if (interval < dataset.interval || interval % dataset.interval !== 0)
    throw new Error("Replay cannot supply a finer or incompatible secondary resolution.");
  const visible = prefix(dataset, closeTime);
  if (interval === dataset.interval) return visible;
  const buckets = new Map<number, OHLCV[]>();
  for (const b of visible) {
    const start = Math.floor(b.time / interval) * interval;
    const group = buckets.get(start) ?? [];
    group.push(b);
    buckets.set(start, group);
  }
  const result: OHLCV[] = [];
  for (const [time, group] of buckets) {
    // A missing sub-bar is unknown, not permission to manufacture a complete HTF bar.
    if (
      time + interval > closeTime ||
      group.length !== interval / dataset.interval ||
      group.some((b, i) => b.time !== time + i * dataset.interval)
    )
      continue;
    result.push({
      time,
      open: group[0]!.open,
      high: Math.max(...group.map((b) => b.high)),
      low: Math.min(...group.map((b) => b.low)),
      close: group.at(-1)!.close,
      volume: group.reduce((sum, b) => sum + (b.volume ?? 0), 0),
    });
  }
  return result;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
