import { describe, expect, it } from "vitest";
import { parsePineReply } from "@/lib/ai/pine-response";

describe("Pine assistant response", () => {
  it("separates script, summary and follow-ups", () => {
    const reply = parsePineReply('```pine\n//@version=5\nindicator("EMA")\n```\n- Uses a 20-period EMA.\nFOLLOW_UPS:\n- Add alerts\n- Change length to 50\n- Add a fill');
    expect(reply.code).toBe('//@version=5\nindicator("EMA")');
    expect(reply.summary).toBe("- Uses a 20-period EMA.");
    expect(reply.suggestions).toEqual(["Add alerts", "Change length to 50", "Add a fill"]);
  });
  it("accepts an existing code-only reply", () => {
    expect(parsePineReply("```pine\nplot(close)\n```").code).toBe("plot(close)");
  });
});