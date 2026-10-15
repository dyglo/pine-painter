// @vitest-environment node
import { expect, it } from "vitest";
import { PineTS } from "pinets";
import { generatePineCode } from "@/lib/ai/pine-ai.server";

// Explicit opt-in: makes billable requests. Normal test runs remain offline.
it.skipIf(process.env["PINE_LIVE_TEST"] !== "1")(
  "both configured models generate executable Pine through the real gateway",
  async () => {
    for (const model of ["openai/gpt-6.1-sol", "openai/gpt-6-luna"] as const) {
      const result = await generatePineCode({
        prompt: "Create a minimal overlay indicator plotting ta.sma(close, 9).",
        model,
        allowance: { tokens: 20000, cost: 0.15, ms: 45000 },
      });
      expect(result.ok, result.ok ? "" : result.message).toBe(true);
      if (!result.ok) return;
      const data = Array.from({ length: 40 }, (_, i) => ({
        openTime: 1700000000000 + i * 60000,
        closeTime: 1700000059999 + i * 60000,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 100,
      }));
      const context = await new PineTS(data).run(result.code);
      expect(Object.keys(context.plots).length).toBeGreaterThan(0);
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBeGreaterThan(0);
      console.info(model, JSON.stringify(result.usage));
    }
  },
  100000,
);
