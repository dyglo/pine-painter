import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { MODELS } from "./recovery";

import { generatePineCode, type GenerateInput } from "./pine-ai.server";

export const generatePine = createServerFn({ method: "POST" })
  .inputValidator((d: GenerateInput) => {
    if (!d || typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("Prompt required");
    if (d.model && !Object.hasOwn(MODELS, d.model)) throw new Error("Unsupported model");
    if (JSON.stringify(d).length > 500000)
      throw new Error("Task context is too large; shorten code or start a new task.");
    if (d.allowance && Object.values(d.allowance).some((v) => !Number.isFinite(v) || v <= 0))
      throw new Error("Invalid budget");
    return {
      prompt: d.prompt.slice(0, 4000),
      previousCode: d.previousCode,
      error: d.error,
      model: d.model,
      strategy: d.strategy,
      repairs: d.repairs,
      allowance: d.allowance
        ? {
            tokens: Math.min(200000, d.allowance.tokens),
            cost: Math.min(10, d.allowance.cost),
            ms: Math.min(60000, d.allowance.ms),
          }
        : undefined,
      runId: d.runId,
      currentCode: d.currentCode,
      history: d.history?.map((m) => {
        if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string")
          throw new Error("Invalid conversation message");
        return { role: m.role, content: m.content };
      }),
    };
  })
  .handler(({ data }) => generatePineCode(data, getRequest().signal));
