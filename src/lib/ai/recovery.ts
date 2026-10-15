import type { PineReply } from "./pine-response";

// Gateway catalog verified 2026-10-15. Prices are USD / million standard tokens.
export const MODELS = {
  "openai/gpt-6.1-sol": { label: "GPT-6.1 Sol", input: 2, output: 10, maxInput: 4, maxOutput: 15 },
  "openai/gpt-6-luna": {
    label: "GPT-6 Luna",
    input: 0.1,
    output: 0.5,
    maxInput: 0.2,
    maxOutput: 0.75,
  },
} as const;
export type ModelId = keyof typeof MODELS;
export type Usage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  estimated: boolean;
};
export type Strategy = "generate" | "patch" | "diagnose" | "rewrite";
export type Attempt = {
  code: string;
  diagnostic: string;
  strategy: Strategy;
  usage: Usage;
  response?: string | undefined;
  model?: ModelId | undefined;
};
export type Budget = { maxMs: number; maxTokens: number; maxCost: number; maxCalls: number };
export const DEFAULT_BUDGET: Budget = { maxMs: 180000, maxTokens: 60000, maxCost: 1, maxCalls: 40 };
export type GenerateInput = {
  prompt: string;
  currentCode?: string | undefined;
  previousCode?: string | undefined;
  error?: string | undefined;
  runId?: string | undefined;
  model?: ModelId | undefined;
  history?: { role: "user" | "assistant"; content: string }[] | undefined;
  repairs?: Attempt[] | undefined;
  strategy?: Strategy | undefined;
  allowance?: { tokens: number; cost: number; ms: number } | undefined;
};
export type GenerateResult =
  | ({ ok: true; runId?: string | undefined } & PineReply & { usage: Usage })
  | {
      ok: false;
      status: number;
      message: string;
      retryable: boolean;
      usage: Usage;
      response?: string | undefined;
    };
export type Recovery = {
  prompt: string;
  currentCode: string;
  history: NonNullable<GenerateInput["history"]>;
  attempts: Attempt[];
  code: string;
  diagnostic: string;
  runId?: string | undefined;
  reply?: PineReply | undefined;
  reason?: string | undefined;
};
export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  estimatedCost: 0,
  estimated: false,
});
export function totals(attempts: Attempt[]): Usage {
  return attempts.reduce(
    (a, b) => ({
      inputTokens: a.inputTokens + b.usage.inputTokens,
      outputTokens: a.outputTokens + b.usage.outputTokens,
      estimatedCost: a.estimatedCost + b.usage.estimatedCost,
      estimated: a.estimated || b.usage.estimated,
    }),
    emptyUsage(),
  );
}
export function normalizeCode(code: string) {
  // Pine indentation is semantic: an indentation repair must remain a new candidate.
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}
export function repairStrategy(attempts: Attempt[]): Strategy {
  if (!attempts.length) return "generate";
  const latest = attempts
    .at(-1)!
    .diagnostic.replace(/\bLine \d+(?::\d+)?/gi, "Line")
    .trim();
  const recurring = attempts.filter(
    (a) => a.diagnostic.replace(/\bLine \d+(?::\d+)?/gi, "Line").trim() === latest,
  ).length;
  // Escalate even when diagnostics change: endless local edits are not progress.
  if (recurring >= 4 || attempts.length >= 4) return "rewrite";
  if (recurring >= 2 || attempts.length >= 2) return "diagnose";
  return "patch";
}

export function applyRepair(text: string, source: string): string {
  const match = text.match(/```json\s*\n([\s\S]*?)```/i);
  if (!match) return text;
  const value = JSON.parse(match[1]!);
  if (!Array.isArray(value.patches) || !value.patches.length || value.patches.length > 20)
    throw new Error("Repair must contain 1–20 patches.");
  let code = source;
  for (const patch of value.patches) {
    if (
      typeof patch.search !== "string" ||
      !patch.search ||
      typeof patch.replace !== "string" ||
      code.split(patch.search).length !== 2
    )
      throw new Error("Patch search must match exactly once.");
    code = code.replace(patch.search, () => patch.replace);
  }
  return `\`\`\`pine\n${code}\n\`\`\`\n${text.slice((match.index ?? 0) + match[0].length)}`;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Cancelled"));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function recoverIndicator(options: {
  state: Recovery;
  budget: Budget;
  model: ModelId;
  signal: AbortSignal;
  generate: (input: GenerateInput, signal: AbortSignal) => Promise<GenerateResult>;
  run: (code: string, signal: AbortSignal) => Promise<{ ok: true } | { ok: false; error: string }>;
  progress: (status: string) => void;
  checkpoint: (state: Recovery) => void;
}): Promise<{ ok: boolean; state: Recovery }> {
  const { budget, model, progress, checkpoint } = options;
  const state = { ...options.state, attempts: [...options.state.attempts] };
  state.reason = undefined;
  if (Object.values(budget).some((v) => !Number.isFinite(v) || v <= 0)) {
    state.reason = "Invalid recovery budget.";
    checkpoint(state);
    return { ok: false, state };
  }
  const started = Date.now();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal.addEventListener("abort", cancel, { once: true });
  if (options.signal.aborted) cancel();
  const timer = setTimeout(cancel, budget.maxMs);
  const signal = controller.signal;
  // A resume gets a new explicit budget, but retains all prior failure evidence.
  const startIndex = state.attempts.length;
  try {
    while (!signal.aborted) {
      const spent = totals(state.attempts.slice(startIndex));
      const remaining = {
        tokens: budget.maxTokens - spent.inputTokens - spent.outputTokens,
        cost: budget.maxCost - spent.estimatedCost,
        ms: budget.maxMs - (Date.now() - started),
      };
      if (
        remaining.tokens <= 0 ||
        remaining.cost <= 0 ||
        remaining.ms <= 0 ||
        state.attempts.length - startIndex >= budget.maxCalls
      ) {
        state.reason = "Recovery budget exhausted.";
        break;
      }
      const strategy = repairStrategy(state.attempts);
      progress(
        strategy === "generate"
          ? "Writing Pine Script…"
          : strategy === "patch"
            ? "Repairing script…"
            : strategy === "diagnose"
              ? "Checking another repair approach…"
              : "Reworking incompatible code…",
      );
      let result: GenerateResult;
      try {
        result = await abortable(
          options.generate(
            {
              prompt: state.prompt,
              currentCode: state.currentCode,
              previousCode: state.code,
              error: state.diagnostic,
              history: state.history,
              repairs: state.attempts,
              strategy,
              model,
              runId: state.runId,
              allowance: remaining,
            },
            signal,
          ),
          signal,
        );
      } catch (error) {
        // The response may be lost after billing; reserve all remaining allowance and stop.
        state.attempts.push({
          code: state.code,
          diagnostic: "Request interrupted; provider usage unknown.",
          strategy,
          model,
          usage: {
            inputTokens: remaining.tokens,
            outputTokens: 0,
            estimatedCost: remaining.cost,
            estimated: true,
          },
        });
        state.reason = signal.aborted
          ? options.signal.aborted
            ? "Recovery cancelled."
            : "Recovery time budget exhausted."
          : error instanceof Error
            ? error.message
            : "Model request failed.";
        break;
      }
      state.runId = result.ok ? result.runId : state.runId;
      const attempt: Attempt = {
        code: result.ok ? result.code : state.code,
        diagnostic: "Chart verification pending or interrupted.",
        strategy,
        usage: result.usage,
        model,
        response: result.ok ? undefined : result.response,
      };
      state.attempts.push(attempt);
      if (!result.ok) {
        attempt.diagnostic = result.message;
        const repeatedResponse =
          result.response &&
          state.attempts.filter((a) => a.response === result.response).length >= 3;
        if (repeatedResponse) {
          state.reason = "Recovery stalled: the model keeps returning an invalid repair.";
          state.diagnostic = result.message;
          break;
        }
        // Transport and billing failures stop; only malformed model repairs are recoverable.
        if (result.status !== 422 || result.usage.estimated) {
          state.reason = result.message;
          break;
        }
        state.diagnostic = result.message;
        checkpoint({ ...state });
        continue;
      }
      const repeated = state.attempts
        .slice(0, -1)
        .some(
          (a) =>
            a.diagnostic !== "Chart verification pending or interrupted." &&
            normalizeCode(a.code) === normalizeCode(result.code),
        );
      state.code = result.code;
      state.reply = result;
      if (repeated) {
        attempt.diagnostic =
          "Rejected identical unsuccessful code. Choose a different implementation.";
        state.diagnostic = attempt.diagnostic;
        const duplicates = state.attempts.filter((a) =>
          a.diagnostic.startsWith("Rejected identical"),
        ).length;
        if (duplicates >= 3) {
          state.reason = "Recovery stalled: the model keeps returning an unsuccessful repair.";
          break;
        }
        checkpoint({ ...state });
        continue;
      }
      checkpoint({ ...state });
      progress("Compiling and checking on chart…");
      const outcome = await abortable(options.run(result.code, signal), signal);
      if (outcome.ok) {
        attempt.diagnostic = "Compiled and applied to chart.";
        state.diagnostic = "";
        state.reason = undefined;
        checkpoint({ ...state });
        return { ok: true, state };
      }
      attempt.diagnostic = outcome.error;
      state.diagnostic = outcome.error;
      checkpoint({ ...state });
      if (result.usage.estimated) {
        state.reason =
          "Provider did not return complete usage; recovery stopped to protect the budget.";
        break;
      }
    }
    if (!state.reason)
      state.reason = options.signal.aborted
        ? "Recovery cancelled."
        : "Recovery time budget exhausted.";
  } catch (error) {
    state.reason = signal.aborted
      ? options.signal.aborted
        ? "Recovery cancelled."
        : "Recovery time budget exhausted."
      : error instanceof Error
        ? error.message
        : "Chart verification failed.";
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", cancel);
    checkpoint({ ...state });
  }
  return { ok: false, state };
}
