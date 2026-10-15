import { describe, expect, it, vi } from "vitest";
import { PineTS } from "pinets";
import {
  applyRepair,
  DEFAULT_BUDGET,
  recoverIndicator,
  normalizeCode,
  totals,
  type GenerateInput,
  type GenerateResult,
  type Recovery,
} from "@/lib/ai/recovery";
import { createChartRunner } from "@/lib/ai/chart-runner";

const usage = { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01, estimated: false };
const reply = (code: string): GenerateResult => ({
  ok: true,
  code,
  summary: "Changed",
  suggestions: [],
  usage,
});
const state = (): Recovery => ({
  prompt: "Plot close",
  currentCode: "editor",
  history: [{ role: "user", content: "Earlier request" }],
  attempts: [],
  code: "",
  diagnostic: "",
});
const setup = () => ({
  state: state(),
  budget: DEFAULT_BUDGET,
  model: "openai/gpt-6.1-sol" as const,
  signal: new AbortController().signal,
  progress: vi.fn(),
  checkpoint: vi.fn(),
  generate: vi.fn(async (_input: GenerateInput) => reply("good")),
  run: vi.fn(async (_code: string, _signal: AbortSignal) => ({ ok: true as const })),
});

describe("autonomous recovery", () => {
  it("only succeeds after chart verification and application complete", async () => {
    const o = setup();
    let applied = false;
    o.run.mockImplementation(async () => {
      applied = true;
      return { ok: true };
    });
    const result = await recoverIndicator(o);
    expect(result.ok && applied).toBe(true);
    expect(totals(result.state.attempts)).toEqual(usage);
    expect(o.generate.mock.calls[0]![0].history).toEqual(o.state.history);
  });
  it("repairs beyond three cycles and changes strategies with actual evidence", async () => {
    const o = setup();
    const inputs: GenerateInput[] = [];
    o.generate.mockImplementation(async (input) => {
      inputs.push(structuredClone(input));
      return reply(`candidate ${inputs.length}`);
    });
    o.run.mockImplementation(async () =>
      inputs.length < 6
        ? ({ ok: false, error: "Line 4: unknown function" } as never)
        : { ok: true },
    );
    const result = await recoverIndicator(o);
    expect(result.ok).toBe(true);
    expect(inputs.map((i) => i.strategy)).toEqual([
      "generate",
      "patch",
      "diagnose",
      "diagnose",
      "rewrite",
      "rewrite",
    ]);
    expect(inputs[1]!.error).toBe("Line 4: unknown function");
    expect(inputs[5]!.repairs).toHaveLength(5);
    expect(inputs[1]!.previousCode).toBe("candidate 1");
  });
  it("does not compile identical unsuccessful repairs and stops stalled calls", async () => {
    const o = setup();
    o.run.mockResolvedValue({ ok: false, error: "Actual error" } as never);
    const result = await recoverIndicator(o);
    expect(result.ok).toBe(false);
    expect(o.run).toHaveBeenCalledTimes(1);
    expect(o.generate).toHaveBeenCalledTimes(4);
    expect(result.state.reason).toContain("stalled");
    expect(result.state.attempts[0]!.diagnostic).toBe("Actual error");
  });
  it("preserves invalid patch responses and stops repeated malformed repairs", async () => {
    const o = setup();
    o.generate.mockResolvedValue({
      ok: false,
      status: 422,
      message: "Patch search must match exactly once.",
      retryable: true,
      usage,
      response: '{"patches":[]}',
    });
    const result = await recoverIndicator(o);
    expect(result.ok).toBe(false);
    expect(o.generate).toHaveBeenCalledTimes(3);
    expect(o.run).not.toHaveBeenCalled();
    expect(result.state.reason).toContain("stalled");
    expect(result.state.attempts[0]!.response).toBe('{"patches":[]}');
  });
  it.each(["maxTokens", "maxCost", "maxCalls"] as const)(
    "stops at %s with code and diagnostics preserved",
    async (key) => {
      const o = setup();
      o.budget = {
        ...DEFAULT_BUDGET,
        [key]: key === "maxTokens" ? 150 : key === "maxCost" ? 0.01 : 1,
      };
      o.run.mockResolvedValue({ ok: false, error: "Broken plot" } as never);
      const result = await recoverIndicator(o);
      expect(o.generate).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      expect(result.state.code).toBe("good");
      expect(result.state.diagnostic).toBe("Broken plot");
      expect(result.state.reason).toContain("budget");
    },
  );
  it("cancels a pending model call promptly and reserves unknown spend", async () => {
    const o = setup();
    const c = new AbortController();
    o.signal = c.signal;
    o.generate.mockImplementation(() => new Promise(() => {}));
    const pending = recoverIndicator(o);
    c.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.state.reason).toContain("cancelled");
    expect(o.run).not.toHaveBeenCalled();
    expect(totals(result.state.attempts).estimated).toBe(true);
  });
  it("times out hung chart checks and never claims success", async () => {
    vi.useFakeTimers();
    try {
      const o = setup();
      o.budget = { ...DEFAULT_BUDGET, maxMs: 20 };
      o.run.mockImplementation(() => new Promise(() => {}));
      const pending = recoverIndicator(o);
      await vi.advanceTimersByTimeAsync(21);
      const result = await pending;
      expect(result.ok).toBe(false);
      expect(result.state.reason).toContain("time budget");
    } finally {
      vi.useRealTimers();
    }
  });
  it("resumes using previous diagnostics and a fresh explicit budget", async () => {
    const o = setup();
    o.state = {
      ...state(),
      code: "bad",
      diagnostic: "Unknown name",
      reason: "budget exhausted",
      attempts: [{ code: "bad", diagnostic: "Unknown name", strategy: "generate", usage }],
    };
    expect((await recoverIndicator(o)).ok).toBe(true);
    expect(o.generate.mock.calls[0]![0].strategy).toBe("patch");
    expect(o.generate.mock.calls[0]![0].allowance!.cost).toBe(DEFAULT_BUDGET.maxCost);
  });
  it("applies unique targeted patches and rejects ambiguous edits", () => {
    expect(normalizeCode("if close > open\n    plot(close)")).not.toBe(
      normalizeCode("if close > open\nplot(close)"),
    );
    expect(
      applyRepair(
        '```json\n{"patches":[{"search":"bad(close)","replace":"ta.sma(close, 9)"}]}\n```',
        "plot(bad(close))",
      ),
    ).toContain("plot(ta.sma(close, 9))");
    expect(() =>
      applyRepair('```json\n{"patches":[{"search":"a","replace":"b"}]}\n```', "a a"),
    ).toThrow("exactly once");
  });
  it("compiles and executes Pine with the installed PineTS engine using offline candles", async () => {
    const candles = Array.from({ length: 50 }, (_, i) => ({
      openTime: 1700000000000 + i * 60000,
      closeTime: 1700000059999 + i * 60000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
      volume: 100,
    }));
    const engine = new PineTS(candles);
    const context = await engine.run(
      '//@version=5\nindicator("Test", overlay=true)\nplot(ta.sma(close, 9), "SMA")',
    );
    expect(context.plots["SMA"]!.data.at(-1)!.value).toBe(146);
    await expect(
      new PineTS(candles).run('//@version=5\nindicator("Broken")\nplot(unknownThing(close))'),
    ).rejects.toThrow();
  });
});

describe("transactional chart application", () => {
  it("preserves working handle on compiler failure and replaces it after success", async () => {
    const previous = { remove: vi.fn() };
    const next = { remove: vi.fn() };
    const compile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, handle: previous })
      .mockResolvedValueOnce({ ok: false, error: new Error("compile failed") })
      .mockResolvedValueOnce({ ok: true, handle: next });
    const runner = createChartRunner(compile, String);
    await runner.run("old");
    await runner.run("bad");
    expect(previous.remove).not.toHaveBeenCalled();
    await runner.run("new");
    expect(previous.remove).toHaveBeenCalledTimes(1);
    expect(next.remove).not.toHaveBeenCalled();
  });
  it("discards a late successful candidate after cancellation, preserving the working chart", async () => {
    const previous = { remove: vi.fn() };
    const late = { remove: vi.fn() };
    let finish!: (value: { ok: boolean; handle: typeof late }) => void;
    const compile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, handle: previous })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const runner = createChartRunner(compile, String);
    await runner.run("old");
    const c = new AbortController();
    const pending = runner.run("candidate", c.signal);
    await Promise.resolve();
    c.abort();
    finish({ ok: true, handle: late });
    expect((await pending).ok).toBe(false);
    expect(late.remove).toHaveBeenCalledTimes(1);
    expect(previous.remove).not.toHaveBeenCalled();
  });
});
