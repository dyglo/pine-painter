import { Bell, CircleHelp, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspacePanel } from "../ChartWorkspace";
import source from "./source.json";

function SourceIcon({ id }: { id: number }) {
  const node = source.nodes.find((item) => item.key === id)!;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: node.html }} />
  );
}

export function RightSidebar({
  activePanel,
  trading,
  onPanel,
  onTrade,
}: {
  activePanel: WorkspacePanel;
  trading: boolean;
  onPanel: (panel: WorkspacePanel) => void;
  onTrade: () => void;
}) {
  const button = (label: string, icon: ReactNode, action?: () => void, expanded?: boolean) => (
    <button
      key={label}
      type="button"
      className="quant-sidebar-button"
      aria-label={label}
      title={action ? label : `${label} — Coming soon`}
      aria-disabled={action ? undefined : true}
      aria-expanded={expanded}
      onClick={action}
    >
      {icon}
    </button>
  );
  return (
    <nav
      className="quant-sidebar"
      aria-label="Chart sidebar"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="quant-sidebar-top">
        {button("Watchlist", <SourceIcon id={220} />)}
        {button("Alerts", <SourceIcon id={221} />)}
        {button("Object tree", <SourceIcon id={222} />)}
      </div>
      <div className="quant-sidebar-bottom">
        {button("AI Copilot", <Sparkles />, () => onPanel("ai"), activePanel === "ai")}
        {button("Trade", <SourceIcon id={224} />, onTrade, trading)}
        {button(
          "Indicators panel",
          <SourceIcon id={225} />,
          () => onPanel("code"),
          activePanel === "code",
        )}
        {button("Calendar", <SourceIcon id={226} />)}
        {button("News feed", <SourceIcon id={227} />)}
        {button("Notifications", <Bell />)}
        {button("Chats", <SourceIcon id={223} />)}
        {button(
          "More apps",
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <rect
                key={index}
                x={4 + (index % 3) * 7}
                y={4 + Math.floor(index / 3) * 7}
                width="3"
                height="3"
                rx="0.5"
                fill="currentColor"
                stroke="none"
              />
            ))}
          </svg>,
        )}
        <div className="quant-sidebar-divider" role="separator" />
        {button("Help", <CircleHelp />)}
      </div>
    </nav>
  );
}
