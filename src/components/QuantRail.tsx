import { ChevronsLeft, ChevronsRight, Code2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function QuantRail({ view, collapsed, onView, onToggle }: {
  view: "ai" | "code"; collapsed: boolean; onView: (view: "ai" | "code") => void; onToggle: () => void;
}) {
  return <TooltipProvider delayDuration={150}><nav aria-label="Activity rail" className="z-40 flex w-14 shrink-0 flex-col items-center border-r border-border bg-background py-4">
    <div aria-label="Pine Lab Quant" className="mb-8 flex size-8 items-center justify-center text-foreground">
      <svg viewBox="0 0 32 32" className="size-7" fill="none" aria-hidden="true"><path d="M5 7h7l8 18h-7L5 7Zm15 0h7l-7 18h-7l7-18Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    </div>
    <div className="flex flex-col gap-3">{([{ id: "ai", label: "AI assistant", Icon: Terminal }, { id: "code", label: "Pine editor", Icon: Code2 }] as const).map(({ id, label, Icon }) => <Tooltip key={id}><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={label} aria-pressed={!collapsed && view === id} onClick={() => onView(id)} className={cn("rounded-md text-muted-foreground", !collapsed && view === id && "bg-accent text-foreground")}><Icon className="size-[18px]" /></Button></TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>)}</div>
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="mt-auto text-muted-foreground" aria-label={collapsed ? "Expand panel" : "Collapse panel"} onClick={onToggle}>{collapsed ? <ChevronsRight /> : <ChevronsLeft />}</Button></TooltipTrigger><TooltipContent side="right">{collapsed ? "Expand panel" : "Collapse panel"}</TooltipContent></Tooltip>
  </nav></TooltipProvider>;
}