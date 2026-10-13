export type PineReply = { code: string; summary: string; suggestions: string[] };

export function parsePineReply(text: string): PineReply {
  const match = text.match(/```(?:pine|pinescript)?\s*\n([\s\S]*?)```/i);
  const code = (match?.[1] ?? text).trim();
  const remaining = match ? text.slice((match.index ?? 0) + match[0].length).trim() : "";
  const [summary, followUps = ""] = remaining.split(/\n?FOLLOW_UPS:\s*/i);
  return {
    code,
    summary: summary.trim() || "- Updated the Pine Script indicator and its chart plots.",
    suggestions: followUps
      .split("\n")
      .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3),
  };
}
