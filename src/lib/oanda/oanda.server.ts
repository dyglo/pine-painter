import {
  GRANULARITY_MS,
  pageWindows,
  toBar,
  type Bar,
  type OandaGranularity,
  type OandaInstrument,
} from "./oanda-shared";

const BASE = "https://api-fxpractice.oanda.com/v3";
const MAX = 5000;

type Entry = { at: number; ttl: number; bars: Bar[] };
const cache = new Map<string, Entry>();
const CACHE_LIMIT = 300;

function getCached(key: string) {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > e.ttl) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, e);
  return e.bars;
}
function setCached(key: string, bars: Bar[], ttl: number) {
  cache.set(key, { at: Date.now(), ttl, bars });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

export class OandaError extends Error {}

async function request(
  instrument: OandaInstrument,
  granularity: OandaGranularity,
  params: Record<string, string>,
): Promise<{ bars: Bar[]; complete: boolean[] }> {
  const token = process.env["OANDA_API_TOKEN"];
  if (!token) throw new OandaError("OANDA key not configured");
  const qs = new URLSearchParams({ price: "M", granularity, ...params });
  const res = await fetch(`${BASE}/instruments/${instrument}/candles?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, "Accept-Datetime-Format": "RFC3339" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OANDA error", res.status, body.slice(0, 300));
    throw new OandaError(
      res.status === 401 ? "OANDA rejected the API key" : `OANDA request failed (${res.status})`,
    );
  }
  const json = (await res.json()) as { candles?: Parameters<typeof toBar>[0][] };
  const bars: Bar[] = [];
  const complete: boolean[] = [];
  for (const c of json.candles ?? []) {
    const b = toBar(c);
    if (b) {
      bars.push(b);
      complete.push(c.complete);
    }
  }
  return { bars, complete };
}

/** History: pages of up to 5000 candles, each closed page cached. */
export async function fetchHistory(
  instrument: OandaInstrument,
  granularity: OandaGranularity,
  range: { from?: number | undefined; to?: number | undefined; limit?: number | undefined },
): Promise<Bar[]> {
  const step = GRANULARITY_MS[granularity];
  const now = Date.now();
  const to = Math.min(range.to ?? now, now);
  const limit = Math.min(Math.max(range.limit ?? 1500, 1), 20000);
  const from = range.from ?? to - step * limit;
  const all = new Map<number, Bar>();
  for (const w of pageWindows(from, to, step, MAX)) {
    // Align to step so cache keys repeat between calls.
    const a = Math.floor(w.from / step) * step;
    const b = Math.ceil(w.to / step) * step;
    const isRecent = b >= now - step;
    const key = `${instrument}|${granularity}|${a}|${b}`;
    let bars = getCached(key);
    if (!bars) {
      const params: Record<string, string> = { from: new Date(a).toISOString() };
      if (isRecent) params["count"] = String(Math.min(MAX, Math.ceil((now - a) / step) + 1));
      else params["to"] = new Date(b).toISOString();
      const r = await request(instrument, granularity, params);
      bars = r.bars;
      setCached(key, bars, isRecent ? 4_000 : 6 * 60 * 60_000);
    }
    for (const bar of bars) all.set(bar.time, bar);
  }
  const sorted = [...all.values()].sort((x, y) => x.time - y.time);
  return range.from == null ? sorted.slice(-limit) : sorted;
}

/** Latest few candles (including the forming one), cached ~4s. */
export async function fetchLatest(instrument: OandaInstrument, granularity: OandaGranularity) {
  const key = `latest|${instrument}|${granularity}`;
  const hit = getCached(key);
  if (hit) return hit;
  const { bars } = await request(instrument, granularity, { count: "3" });
  setCached(key, bars, 4_000);
  return bars;
}
