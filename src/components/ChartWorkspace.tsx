import { brandSvg } from "@/lib/branding";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HtmlReplayWorkspace } from "./chart-design/HtmlReplayWorkspace";
import type { ReplayHost, ReplayHostView } from "@/lib/replay/workspace";
import { createChartRunner, type RunOutcome } from "@/lib/ai/chart-runner";

export type { RunOutcome } from "@/lib/ai/chart-runner";

export type ChartApi = {
  run: (code: string, signal?: AbortSignal) => Promise<RunOutcome>;
};

function formatError(err: unknown): string {
  if (!err) return "Unknown error";
  const e = err as Error & {
    line?: number;
    column?: number;
    loc?: { line?: number; column?: number };
  };
  const parts = [e.message || String(err)];
  const line = e.line ?? e.loc?.line;
  const col = e.column ?? e.loc?.column;
  if (line != null) parts.unshift(`Line ${line}${col != null ? `:${col}` : ""}`);
  return parts.join(" — ");
}

export type WorkspacePanel = "ai" | "code" | null;
export function ChartWorkspace({
  onReady,
  activePanel,
  onPanel,
  panel,
}: {
  onReady: (api: ChartApi) => void;
  activePanel: WorkspacePanel;
  onPanel: (panel: WorkspacePanel) => void;
  panel: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hostRef = useRef<ReplayHost | null>(null);
  const [replay, setReplay] = useState<ReplayHostView>({
    ready: false,
    loading: false,
    dataset: null,
    view: null,
    error: "",
    saved: false,
  });

  useEffect(() => {
    let disposed = false;
    let restoreBranding: (() => void) | undefined;
    let runner: ReturnType<typeof createChartRunner> | undefined;

    (async () => {
      const [
        { createReplayHost },
        { registerRendererDefaults },
        { BinanceProvider },
        { CoinbaseProvider },
        { OandaProvider },
      ] = await Promise.all([
        import("@/lib/replay/workspace"),
        import("@luxalgo/vela"),
        import("@luxalgo/vela/providers/binance"),
        import("@luxalgo/vela/providers/coinbase"),
        import("@/lib/oanda/oanda-provider"),
      ]);
      if (disposed || !ref.current) return;
      restoreBranding = registerRendererDefaults({ attribution: brandSvg });
      const host = createReplayHost(
        ref.current,
        {
          background: "#ffffff",
          textColor: "#131722",
          gridColor: "#f4f6fa",
          borderColor: "#e0e3eb",
          upColor: "#089981",
          downColor: "#f23645",
          fontFamily: '-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,Ubuntu,sans-serif',
        },
        {
          binance: () => new BinanceProvider(),
          coinbase: () => new CoinbaseProvider(),
          oanda: () => new OandaProvider(),
        },
        setReplay,
      );
      hostRef.current = host;
      runner = createChartRunner((code) => host.compile(code), formatError);
      onReady({ run: runner.run });
    })();

    return () => {
      disposed = true;
      runner?.dispose();
      hostRef.current?.dispose();
      hostRef.current = null;
      restoreBranding?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HtmlReplayWorkspace
      state={replay}
      host={hostRef.current}
      chartRef={ref}
      activePanel={activePanel}
      onPanel={onPanel}
      panelContent={panel}
    />
  );
}
