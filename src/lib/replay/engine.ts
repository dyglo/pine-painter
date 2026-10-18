import type {
  EngineCapabilities,
  ExecutionHandlers,
  ExecutionRequest,
  ExecutionSession,
  PreparedScript,
  ScriptingEngine,
} from "@luxalgo/vela";
import { asOfSeries, prefix, type ReplayDataset } from "./dataset";

export class ReplayBarrier {
  private pending = new Set<Promise<void>>();
  private failure: Error | null = null;
  revision = 0;
  invalidate() {
    this.revision++;
    this.failure = null;
  }
  track(task: Promise<void>) {
    const observed = task.catch((error: unknown) =>
      this.fail(error instanceof Error ? error : new Error(String(error))),
    );
    this.pending.add(observed);
    void observed.then(() => this.pending.delete(observed));
  }
  fail(error: Error) {
    this.failure = error;
  }
  async settled() {
    const revision = this.revision;
    // Includes preparations started by Vela after its yield-to-paint boundary.
    await new Promise((resolve) => setTimeout(resolve, 0));
    while (this.pending.size) await Promise.all([...this.pending]);
    if (revision !== this.revision) throw new Error("Replay calculation superseded.");
    if (this.failure) throw this.failure;
  }
}

export type ReplayClock = { dataset: ReplayDataset; closeTime: number; generation: number };

/** Replay-only engine adapter. Live execution still uses the unmodified PineEngine.
 * Every run gets a fresh prepared runtime and static prefix: no incremental context,
 * secondary cache, polling timer, or stale model is carried across replay states.
 */
export class ReplayEngine implements ScriptingEngine {
  readonly language = "pine";
  readonly capabilities: EngineCapabilities;
  private sources = new WeakMap<PreparedScript, { source: string; id: string }>();
  constructor(
    private base: ScriptingEngine,
    private clock: () => ReplayClock,
    private barrier: ReplayBarrier,
  ) {
    this.capabilities = { ...base.capabilities, streaming: false };
  }
  async prepare(source: string, id: string) {
    // Pine may intentionally repaint history with lookahead_on. That is not a
    // research-safe capability. Fail closed rather than edit the user's script.
    if (
      /\b(?:lookahead_on|timenow|math\s*\.\s*random|chart\s*\.\s*(?:left|right)_visible_bar_time|request\s*\.\s*(?!security(?:_lower_tf)?\b)\w+|(?:fetch|eval|Function)\s*\()/.test(
        source,
      )
    )
      throw new Error("This script uses a replay-unsafe data or lookahead capability.");
    const prepared = await this.base.prepare(source, id);
    this.sources.set(prepared, { source, id });
    return prepared;
  }
  execute(req: ExecutionRequest, handlers: ExecutionHandlers): ExecutionSession {
    let stopped = false;
    let run = 0;
    let inner: ExecutionSession | undefined;
    let cancel: (() => void) | undefined;
    let currentInputs = { ...req.inputs };
    let currentProps = { ...req.props };
    const compute = () => {
      const serial = ++run;
      inner?.stop();
      inner = undefined;
      cancel?.();
      const clock = this.clock();
      const { dataset, closeTime, generation } = clock;
      const revision = this.barrier.revision;
      const valid = () =>
        !stopped &&
        serial === run &&
        revision === this.barrier.revision &&
        generation === this.clock().generation;
      let gatewayError: Error | null = null;
      const info = this.sources.get(req.prepared);
      const task = (async () => {
        try {
          if (!info) throw new Error("Unknown replay script.");
          const prepared = await this.base.prepare(info.source, info.id);
          if (!valid()) return;
          const bars = prefix(dataset, closeTime);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              if (valid()) {
                const error = new Error("Replay calculation timed out. Playback is paused.");
                this.barrier.fail(error);
                handlers.onError?.(error);
              }
              ++run;
              inner?.stop();
              resolve();
            }, 15000);
            const finish = () => {
              clearTimeout(timer);
              resolve();
            };
            cancel = finish;
            inner = this.base.execute(
              {
                ...req,
                prepared,
                market: {
                  ...req.market,
                  symbol: dataset.symbol,
                  symbolInfo: dataset.symbolInfo,
                  chartStyle: "candles",
                },
                bars,
                getBars: () => bars.map((b) => ({ ...b })),
                inputs: currentInputs,
                props: currentProps,
                mode: "static",
                historyState: "complete",
                fetchSeries: async (symbol, timeframe, range) => {
                  if (!valid()) return [];
                  try {
                    const result = asOfSeries(dataset, symbol, timeframe, closeTime).filter(
                      (b) =>
                        (range.from == null || b.time >= range.from) &&
                        (range.to == null || b.time <= range.to),
                    );
                    return range.limit == null ? result : result.slice(-range.limit);
                  } catch (error) {
                    gatewayError = error instanceof Error ? error : new Error(String(error));
                    this.barrier.fail(gatewayError);
                    if (valid()) handlers.onError?.(gatewayError);
                    finish();
                    // PineTS 0.11.0 does not propagate a rejected data-loader
                    // promise safely. Signal failure through Vela, then quiesce it
                    // with an empty answer. No model from this run is publishable.
                    queueMicrotask(() => inner?.stop());
                    return [];
                  }
                },
              },
              {
                onModel: (model) => {
                  if (valid()) {
                    if (gatewayError) handlers.onError?.(gatewayError);
                    else handlers.onModel(model);
                  }
                },
                onWarning: (warning) => {
                  if (valid()) handlers.onWarning?.(warning);
                },
                onError: (error) => {
                  if (valid()) {
                    this.barrier.fail(error);
                    handlers.onError?.(error);
                  }
                  finish();
                },
                onDone: () => {
                  if (valid()) {
                    if (gatewayError) handlers.onError?.(gatewayError);
                    else handlers.onDone?.();
                  }
                  finish();
                },
                // Replay is historical; no alerts escape this boundary.
              },
            );
          });
        } catch (e) {
          if (valid()) {
            const error = e instanceof Error ? e : new Error(String(e));
            this.barrier.fail(error);
            handlers.onError?.(error);
          }
        }
      })();
      this.barrier.track(task);
    };
    compute();
    return {
      stop: () => {
        stopped = true;
        ++run;
        inner?.stop();
        cancel?.();
      },
      update: (inputs, props) => {
        currentInputs = { ...currentInputs, ...inputs };
        currentProps = { ...currentProps, ...props };
        compute();
      },
      notifyBars: () => compute(),
      setVisibleRange: () => compute(),
      getContext: async (select) => (await inner?.getContext?.(select)) ?? null,
    };
  }
}
