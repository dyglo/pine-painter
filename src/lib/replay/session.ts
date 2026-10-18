import { simulate, type TradingTape } from "./trading";
import type { EngineVersions, ReplayDataset } from "./dataset";
import { createDataset } from "./dataset";

export type ReplayStatus = "paused" | "playing" | "calculating" | "ended" | "error";
export type ReplayView = { cursor: number; status: ReplayStatus; speed: number; error: string };
export type ReplayPort = { seek(cursor: number, generation: number): Promise<void> };

/** One serialized analytical clock; timers only request a new state AFTER compute. */
export class ReplaySession {
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private playing = false;
  private disposed = false;
  view: ReplayView;
  constructor(
    readonly dataset: ReplayDataset,
    private port: ReplayPort,
    cursor = dataset.warmup,
    private changed: (view: ReplayView) => void = () => {},
  ) {
    this.view = { cursor, status: "paused", speed: 1, error: "" };
  }
  private emit() {
    this.changed({ ...this.view });
  }
  pause() {
    this.playing = false;
    clearTimeout(this.timer);
    if (this.view.status === "playing") this.view.status = "paused";
    this.emit();
  }
  async seek(cursor: number) {
    this.pause();
    if (
      !Number.isInteger(cursor) ||
      cursor < this.dataset.warmup ||
      cursor >= this.dataset.bars.length
    )
      throw new Error("Candle is outside the replay session.");
    const generation = ++this.generation;
    const task = this.queue.then(async () => {
      if (this.disposed || generation !== this.generation) return;
      this.view = { ...this.view, status: "calculating", error: "" };
      this.emit();
      try {
        await this.port.seek(cursor, generation);
        if (this.disposed || generation !== this.generation) return;
        this.view = {
          ...this.view,
          cursor,
          status: cursor === this.dataset.bars.length - 1 ? "ended" : "paused",
        };
      } catch (e) {
        if (this.disposed || generation !== this.generation) return;
        this.playing = false;
        this.view = {
          ...this.view,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        };
      }
      this.emit();
    });
    this.queue = task;
    await task;
  }
  async next() {
    if (this.view.cursor < this.dataset.bars.length - 1) await this.seek(this.view.cursor + 1);
  }
  async previous() {
    if (this.view.cursor > this.dataset.warmup) await this.seek(this.view.cursor - 1);
  }
  setSpeed(speed: number) {
    if (![0.5, 1, 2, 5, 10].includes(speed)) throw new Error("Invalid replay speed.");
    this.view = { ...this.view, speed };
    this.emit();
  }
  play() {
    if (
      this.disposed ||
      this.playing ||
      this.view.status === "calculating" ||
      this.view.status === "error" ||
      this.view.status === "ended"
    )
      return;
    this.playing = true;
    this.view.status = "playing";
    this.emit();
    const tick = async () => {
      if (!this.playing || this.disposed) return;
      const cursor = this.view.cursor + 1;
      const generation = ++this.generation;
      this.view.status = "calculating";
      this.emit();
      // Queue with manual seeks; pause never skips a candle already in calculation.
      const task = this.queue.then(async () => {
        if (this.disposed || generation !== this.generation) return;
        try {
          await this.port.seek(cursor, generation);
          if (this.disposed || generation !== this.generation) return;
          const ended = cursor === this.dataset.bars.length - 1;
          this.view = {
            ...this.view,
            cursor,
            status: ended ? "ended" : this.playing ? "playing" : "paused",
          };
          if (ended) this.playing = false;
        } catch (e) {
          this.playing = false;
          if (!this.disposed && generation === this.generation)
            this.view = {
              ...this.view,
              status: "error",
              error: e instanceof Error ? e.message : String(e),
            };
        }
        this.emit();
      });
      this.queue = task;
      await task;
      if (this.playing) this.timer = setTimeout(() => void tick(), 1000 / this.view.speed);
    };
    this.timer = setTimeout(() => void tick(), 1000 / this.view.speed);
  }
  dispose() {
    this.disposed = true;
    this.pause();
    ++this.generation;
  }
}

export type SavedReplay = {
  schema: 1;
  dataset: ReplayDataset;
  versions: EngineVersions;
  cursor: number;
  speed: number;
  chartState: unknown;
  trading?: TradingTape;
  scripts: {
    id: string;
    source: string;
    inputs: Record<string, unknown>;
    props: Record<string, unknown>;
    visible: boolean;
  }[];
};
export const REPLAY_STORAGE_KEY = "deplyze.replay.v1";
export function saveReplay(storage: Pick<Storage, "setItem">, state: SavedReplay) {
  storage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(state));
}
export async function restoreReplay(raw: string, versions: EngineVersions): Promise<SavedReplay> {
  const saved = JSON.parse(raw) as SavedReplay;
  if (saved.schema !== 1 || JSON.stringify(saved.versions) !== JSON.stringify(versions))
    throw new Error("Replay engine versions changed. Start a new session.");
  const d = saved.dataset;
  const verified = await createDataset({
    symbol: d.symbol,
    timeframe: d.timeframe,
    from: d.requested.from,
    to: d.requested.to,
    bars: d.bars,
    now: d.coverage.lastClose,
    warmup: d.warmup,
    symbolInfo: d.symbolInfo,
  });
  if (verified.id !== d.id || JSON.stringify(verified.coverage) !== JSON.stringify(d.coverage))
    throw new Error("Saved historical dataset failed verification.");
  if (
    !Number.isInteger(saved.cursor) ||
    saved.cursor < d.warmup ||
    saved.cursor >= d.bars.length ||
    ![0.5, 1, 2, 5, 10].includes(saved.speed) ||
    !Array.isArray(saved.scripts) ||
    saved.scripts.some((s) => typeof s.source !== "string" || typeof s.id !== "string")
  )
    throw new Error("Invalid saved replay cursor or chart state.");
  if (saved.trading) simulate(verified, saved.trading, saved.cursor);
  return { ...saved, dataset: verified };
}
