import { BrandMark } from "@/components/BrandMark";
import { BRAND } from "@/lib/branding";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Code2,
  Loader2,
  ChartNoAxesCombined,
  Crosshair,
  Lightbulb,
  Wrench,
  Plus,
  Sparkles,
} from "lucide-react";
import { QuantRail } from "@/components/QuantRail";
import { PineCodeCard } from "@/components/PineCodeCard";
import { PineEditor } from "@/components/PineEditor";
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
      { title: BRAND.name },
      {
        name: "description",
        content: BRAND.description,
      },
      { property: "og:title", content: BRAND.name },
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
  code?: string;
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
              item.id === assistantId
                ? { ...item, suggestions: result.suggestions, code: result.code }
                : item,
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
  const selectView = (view: "ai" | "code") => {
    setTab(view);
    setCollapsed(false);
  };
  return (
    <div className="quant-workspace dark relative flex w-full overflow-hidden bg-background font-sans text-foreground">
      <QuantRail
        view={tab}
        collapsed={collapsed}
        onView={selectView}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <aside
        aria-label="Deplyze Quant panel"
        aria-hidden={collapsed}
        inert={collapsed}
        className={cn(
          "quant-panel flex shrink-0 flex-col overflow-hidden bg-background",
          collapsed && "quant-panel-collapsed",
          tab === "code" && "quant-panel-code",
        )}
      >
        <div className="quant-panel-inner flex h-full min-h-0 flex-col">
          {tab === "ai" ? (
            <>
              <header className="quant-panel-header flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
                <h1 className="text-[13px] font-semibold tracking-tight">{BRAND.name}</h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="New chat"
                  title="New chat"
                  disabled={busy || running}
                  className="text-muted-foreground"
                  onClick={() => {
                    historyRef.current = [];
                    setMessages([]);
                    setPrompt("");
                    inputRef.current?.focus();
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </header>
              <Conversation
                className={cn("min-h-0 flex-1", !messages.length && "quant-empty-conversation")}
              >
                <ConversationContent className="gap-6 px-3 py-5">
                  {!messages.length && (
                    <div className="quant-welcome">
                      <BrandMark className="mx-auto mb-4 size-8" />
                      <h2>
                        What are we
                        <br />
                        working on today?
                      </h2>
                      <p role="status">
                        <span className={cn("quant-status-dot", !ready && "opacity-40")} />
                        {ready ? "Your chart is ready." : "Connecting to your chart�"}
                      </p>
                    </div>
                  )}
                  {messages.map((m) => (
                    <Message key={m.id} from={m.role} className="max-w-full">
                      {m.role === "assistant" && (
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                          Deplyze Quant
                        </div>
                      )}
                      <MessageContent
                        className={cn(
                          "w-full leading-relaxed",
                          m.role === "user" &&
                            "group-[.is-user]:bg-transparent group-[.is-user]:px-0 group-[.is-user]:text-foreground",
                        )}
                      >
                        {m.parts.map((part, i) =>
                          part.type === "text" ? (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          ) : (
                            <Tool key={i} defaultOpen={false} className="mb-0 border-border/60">
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
                      {m.code && (
                        <PineCodeCard
                          code={m.code}
                          onEdit={() => {
                            if (m.code) setCode(m.code);
                            selectView("code");
                          }}
                        />
                      )}
                      {m.suggestions && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {m.suggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              variant="ghost"
                              disabled={busy || running}
                              onClick={() => ask(suggestion)}
                              className="h-auto min-h-9 w-full justify-between gap-3 whitespace-normal rounded-md border border-border px-3 py-2 text-left text-xs font-normal text-muted-foreground"
                            >
                              <span>{suggestion}</span>
                              <ArrowUpRight className="shrink-0" />
                            </Button>
                          ))}
                        </div>
                      )}
                    </Message>
                  ))}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
              <div
                className={cn(
                  "quant-dock shrink-0 px-3 pb-3",
                  !messages.length && "quant-dock-welcome",
                )}
              >
                <PromptInput onSubmit={({ text }) => ask(text)}>
                  <PromptInputTextarea
                    ref={inputRef}
                    aria-label="Message Deplyze Quant"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask Quant anything"
                    className="px-2.5 pt-3"
                  />
                  <PromptInputFooter className="px-2 pb-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="rounded-full bg-secondary"
                        title="Open Pine editor"
                        aria-label="Open Pine editor"
                        onClick={() => selectView("code")}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <select
                        aria-label="AI model"
                        className="quant-model"
                        defaultValue="gpt-5.6"
                        title="Configured generation model"
                      >
                        <option value="gpt-5.6">GPT-5.6</option>
                      </select>
                    </div>
                    <PromptInputSubmit
                      className="size-8 rounded-full"
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
                {!busy && (
                  <div className="quant-action-chips">
                    {(messages.length
                      ? [
                          {
                            label: "Add alerts",
                            Icon: Plus,
                            prompt: "Add alerts to the current indicator",
                          },
                          {
                            label: "Refine styling",
                            Icon: Sparkles,
                            prompt: "Refine the styling of the current indicator",
                          },
                        ]
                      : [
                          {
                            label: "My chart",
                            Icon: Crosshair,
                            prompt: "Explain the current indicator and suggest useful improvements",
                          },
                          {
                            label: "Indicator",
                            Icon: ChartNoAxesCombined,
                            prompt: "Create an indicator that ",
                          },
                          {
                            label: "Fix my code",
                            Icon: Wrench,
                            prompt: "Review and fix the current Pine Script",
                          },
                          { label: "Pine editor", Icon: Code2, prompt: null },
                          {
                            label: "Brainstorm",
                            Icon: Lightbulb,
                            prompt: "Suggest three indicator ideas for intraday trading",
                          },
                        ]
                    ).map(({ label, Icon, prompt: suggestion }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (suggestion === null) {
                            selectView("code");
                            return;
                          }
                          setPrompt(suggestion);
                          inputRef.current?.focus();
                        }}
                      >
                        <Icon aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="quant-disclaimer">
                Quant can make mistakes. Check important results
                <br />
                before you trade.
              </p>
            </>
          ) : (
            <PineEditor
              code={code}
              onChange={setCode}
              onRun={() => run()}
              onCopy={copy}
              copied={copied}
              disabled={!ready || running || busy}
              running={running}
              status={status}
            />
          )}
        </div>
      </aside>
      <main aria-label="Live chart" className="relative min-w-0 flex-1">
        <ClientOnly fallback={<ChartLoading />}>
          <Suspense fallback={<ChartLoading />}>
            <ChartWorkspace onReady={onReady} />
          </Suspense>
        </ClientOnly>
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
