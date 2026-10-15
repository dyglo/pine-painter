// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ stream: vi.fn(), responses: vi.fn((id: string) => id) }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ responses: mocks.responses }) }));
vi.mock("ai", () => ({ streamText: mocks.stream, APICallError: { isInstance: () => false } }));
import { generatePineCode } from "@/lib/ai/pine-ai.server";

describe("Pine gateway request and accounting", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    mocks.stream.mockReset();
    mocks.responses.mockClear();
    mocks.stream.mockReturnValue({
      text: Promise.resolve('```pine\n//@version=5\nindicator("Test")\nplot(close)\n```'),
      totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
    });
  });
  it("uses verified default and alternative gateway IDs with bounded output and retries disabled", async () => {
    const result = await generatePineCode({ prompt: "Plot close" });
    expect(result.ok).toBe(true);
    expect(mocks.responses).toHaveBeenCalledWith("openai/gpt-6.1-sol");
    expect(mocks.stream.mock.calls[0]![0]).toMatchObject({ maxRetries: 0, maxOutputTokens: 8192 });
    expect(result.usage).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.0007,
    });
    await generatePineCode({ prompt: "Plot close", model: "openai/gpt-6-luna" });
    expect(mocks.responses).toHaveBeenLastCalledWith("openai/gpt-6-luna");
  });
  it("does not spend when the conservative reservation will not fit", async () => {
    const result = await generatePineCode({
      prompt: "Plot close",
      allowance: { tokens: 100, cost: 0.000001, ms: 1000 },
    });
    expect(result.ok).toBe(false);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(result.usage.estimatedCost).toBe(0);
  });
  it("records usage even for malformed patches", async () => {
    mocks.stream.mockReturnValue({
      text: Promise.resolve('```json\n{"patches":[{"search":"missing","replace":"x"}]}\n```'),
      totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
    });
    const result = await generatePineCode({
      prompt: "Fix",
      previousCode: "bad",
      error: "Line 4: bad",
      strategy: "patch",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    expect(mocks.stream.mock.calls[0]![0].messages.at(-1).content).toContain("Line 4: bad");
  });
  it("retains a conservative charge when provider usage is missing", async () => {
    mocks.stream.mockReturnValue({
      text: Promise.resolve("no script"),
      totalUsage: Promise.resolve({}),
    });
    const result = await generatePineCode({ prompt: "Plot" });
    expect(result.ok).toBe(false);
    expect(result.usage.estimated).toBe(true);
    expect(result.usage.estimatedCost).toBeGreaterThan(0);
  });
});
