import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  FileCode2,
  Loader2,
  MessageSquare,
  Play,
  CircleCheck,
  AlertTriangle,
  SquareTerminal,
} from "lucide-react";
import type { ChartApi } from "@/components/ChartWorkspace";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolHeader, ToolContent } from "@/components/ai-elements/tool";
import { generatePine } from "@/lib/ai/pine-ai.functions";
import { cn } from "@/lib/utils";

const ChartWorkspace = lazy(() =>
  import("@/components/ChartWorkspace").then((m) => ({ default: m.ChartWorkspace })),
);
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pine Lab — Quant indicator workspace" },
      {
        name: "description",
        content:
          "Create, refine and test Pine Script indicators with GPT-5.6 on a live Vela chart.",
      },
      { property: "og:title", content: "Pine Lab — Quant indicator workspace" },
      {
        property: "og:description",
        content:
          "An AI-assisted Pine Script editor and live chart in one focused trading workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
const DEFAULT_CODE = `//@version=5
indicator("EMA Ribbon", overlay=true)
fast = input.int(9, "Fast")
slow = input.int(21, "Slow")
f = ta.ema(close, fast)
s = ta.ema(close, slow)
plot(f, "Fast EMA", color=color.orange, linewidth=2)
plot(s, "Slow EMA", color=color.aqua, linewidth=2)
`;
type Status = { kind: "idle" | "ok" | "error"; msg?: string };
type Part =
  | { type: "text"; text: string }
  | {
      type: "chart-run";
      state: "input-available" | "output-available" | "output-error";
      text: string;
    };
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  parts: Part[];
  suggestions?: string[];
};
type HistoryTurn = { role: "user" | "assistant"; content: string };
function Index() {
  const apiRef = useRef<ChartApi | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<HistoryTurn[]>([]);
  const busyRef = useRef(false);
  const nextId = useRef(0);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"code" | "ai">("ai");
  const [collapsed, setCollapsed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("Writing Pine Script…");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (tab === "ai" && !collapsed) inputRef.current?.focus();
  }, [tab, collapsed, busy]);
  const onReady = useCallback((api: ChartApi) => {
    apiRef.current = api;
    api.run(DEFAULT_CODE).then((r) => {
      setReady(true);
      setStatus(r.ok ? { kind: "ok", msg: "Running on chart" } : { kind: "error", msg: r.error });
    });
  }, []);
  const run = async (src = code) => {
    if (!apiRef.current) return null;
    setRunning(true);
    try {
      const r = await apiRef.current.run(src);
      setStatus(r.ok ? { kind: "ok", msg: "Running on chart" } : { kind: "error", msg: r.error });
      return r;
    } finally {
      setRunning(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setStatus({ kind: "error", msg: "Could not copy. Select the script and copy it manually." });
    }
  };
  const ask = async (request = prompt) => {
    const p = request.trim();
    if (!p || busyRef.current || running || !apiRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPrompt("");
    setTab("ai");
    const userId = nextId.current++;
    const assistantId = nextId.current++;
    const history = [...historyRef.current];
    historyRef.current.push({ role: "user", content: p });
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", parts: [{ type: "text", text: p }] },
      { id: assistantId, role: "assistant", parts: [] },
    ]);
    const addPart = (part: Part) =>
      setMessages((m) =>
        m.map((item) =>
          item.id === assistantId ? { ...item, parts: [...item.parts, part] } : item,
        ),
      );
    let previousCode: string | undefined;
    let error: string | undefined;
    let runId: string | undefined;
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        setPhase(attempt === 0 ? "Writing Pine Script…" : `Refining script · ${attempt}/3…`);
        const result = await generatePine({
          data: { prompt: p, history, currentCode: code, previousCode, error, runId },
        });
        if (!result.ok) {
          addPart({ type: "text", text: result.message });
          historyRef.current.push({ role: "assistant", content: result.message });
          return;
        }
        runId = result.runId;
        setCode(result.code);
        setPhase("Running on chart…");
        const outcome = await run(result.code);
        if (outcome?.ok) {
          addPart({
            type: "chart-run",
            state: "output-available",
            text: "Indicator applied to the live chart.",
          });
          addPart({ type: "text", text: `### What's Changed\n${result.summary}` });
          setMessages((m) =>
            m.map((item) =>
              item.id === assistantId ? { ...item, suggestions: result.suggestions } : item,
            ),
          );
          historyRef.current.push({
            role: "assistant",
            content: `\`\`\`pine\n${result.code}\n\`\`\`\n${result.summary}\n${result.suggestions.join("\n")}`,
          });
          return;
        }
        previousCode = result.code;
        error = outcome && !outcome.ok ? outcome.error : "Chart not ready";
        addPart({ type: "chart-run", state: "output-error", text: error });
      }
      const failure =
        "The script still has an error after 3 repairs. You can refine the request or edit the script.";
      addPart({ type: "text", text: failure });
      historyRef.current.push({
        role: "assistant",
        content: `${failure}\n${previousCode ?? ""}\n${error ?? ""}`,
      });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Request failed";
      addPart({ type: "text", text });
      historyRef.current.push({ role: "assistant", content: text });
    } finally {
      busyRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  };
  return (
    <div className="quant-workspace dark relative flex w-full overflow-hidden bg-background font-sans text-foreground">
      <aside
        aria-label="Pine workspace panel"
        className={cn(
          "quant-panel shrink-0 flex-col border-r border-border bg-card",
          collapsed ? "hidden" : "flex",
        )}
      >
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
          <div className="flex size-8 items-center justify-center rounded-md border border-input bg-background">
            <SquareTerminal className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Pine Lab</h1>
            <span className="text-[10px] text-muted-foreground">QUANT WORKSPACE</span>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            aria-label="Collapse panel"
            title="Collapse panel"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft />
          </Button>
        </header>
        <div
          role="tablist"
          aria-label="Workspace view"
          className="flex h-12 shrink-0 gap-5 border-b border-border px-5"
        >
          {(["ai", "code"] as const).map((t) => (
            <Button
              key={t}
              role="tab"
              aria-selected={tab === t}
              variant="ghost"
              onClick={() => setTab(t)}
              className={cn(
                "h-full rounded-none border-b-2 px-0 text-xs hover:bg-transparent",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {t === "ai" ? <MessageSquare /> : <Code2 />}
              {t === "ai" ? "AI Chat" : "Pine Editor"}
            </Button>
          ))}
        </div>
        {tab === "ai" ? (
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-6 px-5 py-6">
              {messages.map((m) => (
                <Message key={m.id} from={m.role} className="max-w-full">
                  {m.role === "assistant" && (
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                      <SquareTerminal className="size-3.5 text-muted-foreground" />
                      Pine Assistant
                    </div>
                  )}
                  <MessageContent
                    className={cn(
                      "w-full leading-relaxed",
                      m.role === "user" &&
                        "group-[.is-user]:bg-secondary group-[.is-user]:text-secondary-foreground",
                    )}
                  >
                    {m.parts.map((part, i) =>
                      part.type === "text" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <Tool key={i} defaultOpen={false} className="mb-0">
                          <ToolHeader
                            type="tool-chart"
                            title="Run indicator"
                            state={part.state}
                            className="gap-2 p-2.5 [&_span]:text-[11px]"
                          />
                          <ToolContent>
                            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                              {part.text}
                            </pre>
                          </ToolContent>
                        </Tool>
                      ),
                    )}
                    {busy && m.id === messages.at(-1)?.id && (
                      <Shimmer className="py-2 text-xs">{phase}</Shimmer>
                    )}
                  </MessageContent>
                  {m.suggestions && (
                    <div className="mt-2 flex flex-col gap-2">
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        Next steps
                      </span>
                      {m.suggestions.map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          disabled={busy || running}
                          onClick={() => ask(s)}
                          className="h-auto min-h-9 w-full justify-between gap-3 whitespace-normal bg-transparent px-3 py-2 text-left text-xs font-normal"
                        >
                          <span>{s}</span>
                          <ArrowUpRight className="shrink-0 text-muted-foreground" />
                        </Button>
                      ))}
                    </div>
                  )}
                </Message>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <FileCode2 className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">indicator.pine</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={copied ? "Copied" : "Copy Pine"}
                title="Copy Pine"
                onClick={copy}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button size="sm" disabled={!ready || running || busy} onClick={() => run()}>
                {running ? <Loader2 className="animate-spin" /> : <Play />}Run
              </Button>
            </div>
            <textarea
              aria-label="Pine Script code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (ready && !running && !busy) run();
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  const t = e.currentTarget;
                  const start = t.selectionStart;
                  setCode(code.slice(0, start) + "    " + code.slice(t.selectionEnd));
                  requestAnimationFrame(() => {
                    t.selectionStart = t.selectionEnd = start + 4;
                  });
                }
              }}
              className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs leading-6 outline-none"
            />
            {status.kind !== "idle" && (
              <div
                role="status"
                className={cn(
                  "flex max-h-36 gap-2 overflow-auto border-t border-border px-4 py-3 text-xs",
                  status.kind === "ok" ? "text-success" : "text-destructive",
                )}
              >
                {status.kind === "ok" ? (
                  <CircleCheck className="size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0" />
                )}
                <pre className="whitespace-pre-wrap break-words font-mono">{status.msg}</pre>
              </div>
            )}
          </div>
        )}
        <div className="quant-dock shrink-0 border-t border-border p-4">
          <PromptInput onSubmit={({ text }) => ask(text)}>
            <PromptInputTextarea
              ref={inputRef}
              aria-label="Message Pine Assistant"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe or refine an indicator…"
              className="px-3.5 pt-3.5"
            />
            <PromptInputFooter className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">GPT-5.6</span>
                <span className="mx-1 h-3 border-l border-input" />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Open Pine editor"
                  aria-label="Open Pine editor"
                  onClick={() => setTab("code")}
                >
                  <Code2 />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Copy current Pine Script"
                  aria-label="Copy current Pine Script"
                  onClick={copy}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <PromptInputSubmit
                aria-label="Send message"
                title="Send message"
                status={busy ? "submitted" : "ready"}
                disabled={busy || running || !ready || !prompt.trim()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  ready ? "bg-success" : "bg-muted-foreground",
                )}
              />
              {ready ? "Chart connected" : "Connecting chart…"}
            </span>
            <span>Pine Script v5 / v6</span>
          </div>
        </div>
      </aside>
      <main aria-label="Live chart" className="relative min-w-0 flex-1">
        <ClientOnly fallback={<ChartLoading />}>
          <Suspense fallback={<ChartLoading />}>
            <ChartWorkspace onReady={onReady} />
          </Suspense>
        </ClientOnly>
        {collapsed && (
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute left-12 top-24 z-40 bg-card"
            aria-label="Expand panel"
            title="Expand panel"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight />
          </Button>
        )}
      </main>
    </div>
  );
}
function ChartLoading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading chart…
    </div>
  );
}
