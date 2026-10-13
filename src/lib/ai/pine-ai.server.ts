import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-5.6-sol";

const INSTRUCTIONS = `You are an expert TradingView Pine Script author.
Write a complete Pine Script v5 or v6 INDICATOR (never strategy()) for the user's request.
Rules:
- Start with //@version=5 or //@version=6, then indicator(...).
- Use only standard built-ins (ta.*, math.*, input.*, plot, plotshape, hline, bgcolor, fill, color.*).
- Prefer simple, robust code that compiles on first try.
- Output ONLY the Pine code inside a single \`\`\`pine fenced block, no explanation.
If you are given a previous attempt and an error, fix the error and return the full corrected script.`;

export type GenerateInput = {
  prompt: string;
  previousCode?: string;
  error?: string;
  runId?: string;
};

export type GenerateResult =
  | { ok: true; code: string; runId?: string }
  | { ok: false; status: number; message: string; retryable: boolean };

function extractCode(text: string) {
  const m = text.match(/```(?:pine|pinescript)?\s*\n([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

export async function generatePineCode(input: GenerateInput): Promise<GenerateResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, status: 401, message: "AI is not configured.", retryable: false };

  const runIdFetch = createLovableAiGatewayRunIdFetch(input.runId);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let userText = `Request: ${input.prompt}`;
  if (input.previousCode && input.error) {
    userText += `\n\nYour previous script:\n\`\`\`pine\n${input.previousCode}\n\`\`\`\n\nIt failed on the chart with this error:\n${input.error}\n\nReturn the full fixed script.`;
  }

  try {
    let streamError: unknown;
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content: userText }],
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    if (streamError) throw streamError;
    const code = extractCode(text);
    if (!code) return { ok: false, status: 502, message: "The AI returned no code.", retryable: false };
    return { ok: true, code, runId: runIdFetch.getRunId() };
  } catch (error) {
    const status = APICallError.isInstance(error) ? (error.statusCode ?? 500) : 500;
    let message = error instanceof Error ? error.message : "AI request failed.";
    if (status === 402) message = "AI credits are used up. Add credits in workspace billing settings.";
    if (status === 429) message = "Too many requests right now. Please wait a moment and try again.";
    console.error(error);
    return { ok: false, status, message, retryable: status === 429 || status >= 500 };
  }
}
