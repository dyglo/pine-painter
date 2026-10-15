export type RunOutcome = { ok: true } | { ok: false; error: string };
type Handle = { remove: () => void };

// Serialize candidates and commit only after the engine's compile/runtime check.
export function createChartRunner(
  compile: (code: string) => Promise<{
    ok: boolean;
    handle: Handle | null;
    error: unknown;
  }>,
  formatError: (error: unknown) => string,
) {
  let working: Handle | null = null;
  let disposed = false;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    dispose: () => {
      disposed = true;
    },
    run(code: string, signal?: AbortSignal): Promise<RunOutcome> {
      const task = queue.then(async (): Promise<RunOutcome> => {
        if (disposed || signal?.aborted) return { ok: false, error: "Chart run cancelled" };
        try {
          const result = await compile(code);
          if (!result.ok || !result.handle) return { ok: false, error: formatError(result.error) };
          if (disposed || signal?.aborted) {
            result.handle.remove();
            return { ok: false, error: "Chart run cancelled" };
          }
          const previous = working;
          working = result.handle;
          try {
            previous?.remove();
          } catch {
            /* Already removed by chart. */
          }
          return { ok: true };
        } catch (error) {
          return { ok: false, error: formatError(error) };
        }
      });
      queue = task;
      return task;
    },
  };
}
