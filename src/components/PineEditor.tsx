import { useRef } from "react";
import { AlertTriangle, Check, CircleCheck, Copy, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PineEditor({ code, onChange, onRun, onCopy, copied, disabled, running, status }: {
  code: string; onChange: (code: string) => void; onRun: () => void; onCopy: () => void;
  copied: boolean; disabled: boolean; running: boolean; status: { kind: "idle" | "ok" | "error"; msg?: string };
}) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = code.split("\n");
  const explicitLine = status.msg?.match(/(?:line\s+|:)(\d+)/i)?.[1];
  const unknownName = status.msg?.match(/([\w.]+) is not defined/)?.[1];
  const inferredLine = unknownName ? lines.findIndex((line) => line.includes(unknownName)) + 1 : 0;
  const errorLine = explicitLine ? Number(explicitLine) : inferredLine;
  return <section aria-label="Pine editor" className="flex min-h-0 flex-1 flex-col bg-background">
    <header className="flex h-14 shrink-0 items-center gap-2 px-4"><span className="font-mono text-xs text-muted-foreground">indicator.pine</span><span title={status.msg ?? "Ready"} className="ml-auto">{running ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : status.kind === "ok" ? <CircleCheck className="size-3.5 text-success" /> : status.kind === "error" ? <AlertTriangle className="size-3.5 text-destructive" /> : null}</span><Button variant="ghost" size="icon-sm" onClick={onCopy} aria-label="Copy Pine" title="Copy Pine">{copied ? <Check /> : <Copy />}</Button><Button size="sm" disabled={disabled} onClick={onRun}><Play className="size-3.5" />Run</Button></header>
    <div className="relative flex min-h-0 flex-1 overflow-hidden"><div ref={gutterRef} aria-hidden="true" className="w-11 shrink-0 overflow-hidden py-4 pr-2 text-right font-mono text-xs leading-6 text-muted-foreground select-none">{lines.map((_, i) => <div key={i} className={cn(status.kind === "error" && errorLine === i + 1 && "text-destructive")}>{i + 1}</div>)}</div><textarea aria-label="Pine Script code" value={code} onChange={(e) => onChange(e.target.value)} onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!disabled) onRun(); } if (e.key === "Tab") { e.preventDefault(); const input = e.currentTarget; const start = input.selectionStart; onChange(code.slice(0, start) + "    " + code.slice(input.selectionEnd)); requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 4; }); } }} spellCheck={false} wrap="off" className="min-h-0 min-w-0 flex-1 resize-none overflow-auto bg-transparent py-4 pr-4 font-mono text-xs leading-6 outline-none" /></div>
    {status.kind === "error" && <div role="alert" className="flex max-h-36 shrink-0 gap-2 overflow-auto border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0" /><div><div className="mb-1 font-medium">{errorLine > 0 ? `Line ${errorLine}` : "Compilation error"}</div><pre className="whitespace-pre-wrap break-words font-mono">{status.msg}</pre></div></div>}
  </section>;
}