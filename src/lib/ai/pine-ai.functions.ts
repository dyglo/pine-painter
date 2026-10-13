import { createServerFn } from "@tanstack/react-start";

import { generatePineCode, type GenerateInput } from "./pine-ai.server";

export const generatePine = createServerFn({ method: "POST" })
  .inputValidator((d: GenerateInput) => {
    if (!d || typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("Prompt required");
    return {
      prompt: d.prompt.slice(0, 4000),
      previousCode: d.previousCode?.slice(0, 20000),
      error: d.error?.slice(0, 4000),
      runId: d.runId,
    };
  })
  .handler(({ data }) => generatePineCode(data));
