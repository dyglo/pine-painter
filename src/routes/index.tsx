import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Bot, Check, Copy, Loader2, Play, Code2, AlertTriangle, CircleCheck } from "lucide-react";

import type { ChartApi } from "@/components/ChartWorkspace";
import { generatePine } from "@/lib/ai/pine-ai.functions";
import { cn } from "@/lib/utils";

const ChartWorkspace = lazy(() =>
  import("@/components/ChartWorkspace").then((m) => ({ default: m.ChartWorkspace })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pine Lab — Write & test Pine Script indicators" },
      {
        name: "description",
        content: "Write, run and AI-generate TradingView Pine Script indicators on a live chart.",
      },
      { property: "og:title", content: "Pine Lab — Write & test Pine Script indicators" },
      {
        property: "og:description",
        content: "Write, run and AI-generate TradingView Pine Script indicators on a live chart.",
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

const MAX_RETRIES = 3;

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "error"; msg: string };
type LogItem = { role: "user" | "step" | "ok" | "error"; text: string };

function Index() {
  const apiRef = useRef<ChartApi | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"code" | "ai">("ai");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);

  const onReady = useCallback((api: ChartApi) => {
    apiRef.current = api;
    setReady(true);
    api.run(DEFAULT_CODE).then((r) =>
      setStatus(r.ok ? { kind: "ok", msg: "Running on chart" } : { kind: "error", msg: r.error }),
    );
  }, []);

  const run = async (src = code) => {
    if (!apiRef.current) return null;
    setRunning(true);
    const r = await apiRef.current.run(src);
    setRunning(false);
    setStatus(r.ok ? { kind: "ok", msg: "Running on chart" } : { kind: "error", msg: r.error });
    return r;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ask = async () => {
    const p = prompt.trim();
    if (!p || busy || !apiRef.current) return;
    setBusy(true);
    setLog((l) => [...l, { role: "user", text: p }]);
    setPrompt("");
    let prev: string | undefined;
    let err: string | undefined;
    let runId: string | undefined;
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        setLog((l) => [
          ...l,
          { role: "step", text: attempt === 0 ? "Writing indicator…" : `Fixing error (retry ${attempt}/${MAX_RETRIES})…` },
        ]);
        const res = await generatePine({ data: { prompt: p, previousCode: prev, error: err, runId } });
        if (!res.ok) {
          setLog((l) => [...l, { role: "error", text: res.message }]);
          return;
        }
        runId = res.runId;
        setCode(res.code);
        const r = await run(res.code);
        if (r?.ok) {
          setLog((l) => [...l, { role: "ok", text: "Indicator is running on the chart." }]);
          return;
        }
        prev = res.code;
        err = r && !r.ok ? r.error : "Unknown error";
        setLog((l) => [...l, { role: "error", text: err! }]);
      }
      setLog((l) => [...l, { role: "error", text: "Couldn't fix it after 3 retries. Try rephrasing or edit the code." }]);
    } catch (e) {
      setLog((l) => [...l, { role: "error", text: e instanceof Error ? e.message : "Request failed" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-background font-sans text-foreground">
      <main className="relative min-w-0 flex-1">
        <ClientOnly fallback={<ChartLoading />}>
          <Suspense fallback={<ChartLoading />}>
            <ChartWorkspace onReady={onReady} />
          </Suspense>
        </ClientOnly>
      </main>

      <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <h1 className="text-sm font-semibold tracking-wide">PINE LAB</h1>
          <div className="ml-auto flex rounded-md bg-muted p-0.5 text-xs">
            {(["ai", "code"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors",
                  tab === t ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                {t === "ai" ? "Assistant" : "Editor"}
              </button>
            ))}
          </div>
        </header>

        {tab === "code" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button
                onClick={() => run()}
                disabled={!ready || running}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run
              </button>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Pine"}
              </button>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">⌘↵ to run</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
                if (e.key === "Tab") {
                  e.preventDefault();
                  const t = e.currentTarget;
                  const s = t.selectionStart;
                  const v = code.slice(0, s) + "    " + code.slice(t.selectionEnd);
                  setCode(v);
                  requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 4));
                }
              }}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-background p-4 font-mono text-[13px] leading-relaxed outline-none"
            />
            <StatusBar status={status} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
              {log.length === 0 && (
                <div className="space-y-3 text-muted-foreground">
                  <p>Describe an indicator and I'll write the Pine Script, run it on the chart, and fix any errors automatically.</p>
                  {["RSI with overbought/oversold background", "Bollinger Bands with squeeze markers", "MACD histogram colored by momentum"].map((s) => (
                    <button key={s} onClick={() => setPrompt(s)} className="block w-full rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-accent hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {log.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md px-3 py-2",
                    m.role === "user" && "ml-8 bg-primary text-primary-foreground",
                    m.role === "step" && "text-xs text-muted-foreground",
                    m.role === "ok" && "border border-success/40 text-success",
                    m.role === "error" && "border border-destructive/40 font-mono text-xs text-destructive",
                  )}
                >
                  {m.text}
                </div>
              ))}
              {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            <div className="border-t border-border p-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                rows={3}
                placeholder="e.g. Supertrend with buy/sell labels"
                className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => setTab("code")} className="text-xs text-muted-foreground hover:text-foreground">
                  View code →
                </button>
                <button
                  onClick={ask}
                  disabled={busy || !ready || !prompt.trim()}
                  className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function StatusBar({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  const ok = status.kind === "ok";
  return (
    <div
      className={cn(
        "flex max-h-40 items-start gap-2 overflow-y-auto border-t px-3 py-2 font-mono text-xs",
        ok ? "border-success/40 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {ok ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <pre className="whitespace-pre-wrap">{status.msg}</pre>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading chart…
    </div>
  );
}
