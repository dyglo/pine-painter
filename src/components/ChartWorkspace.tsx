import { brandSvg } from "@/lib/branding";
import { useEffect, useRef, useState } from "react";
import { ReplayTradingPanel } from "./ReplayTradingPanel";
import { BarReplayControls } from "./BarReplayControls";
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

export function ChartWorkspace({ onReady }: { onReady: (api: ChartApi) => void }) {
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
      const tokens = getComputedStyle(ref.current);
      const token = (name: string) => tokens.getPropertyValue(name).trim();
      const host = createReplayHost(
        ref.current,
        {
          background: token("--background"),
          textColor: token("--muted-foreground"),
          gridColor: token("--card"),
          borderColor: token("--border"),
          upColor: token("--success"),
          downColor: token("--destructive"),
          fontFamily: token("--font-sans"),
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
    <div
      className={`replay-workspace flex h-full min-h-0 w-full ${replay.dataset ? "is-replaying" : "is-live"} ${replay.selecting ? "is-selecting" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <div
            ref={ref}
            className="absolute inset-0"
            inert={replay.loading}
            aria-busy={replay.loading}
          />
          {replay.selecting && (
            <div className="replay-selection" role="status">
              Select a historical candle ·{" "}
              {replay.selectionTime != null
                ? new Date(replay.selectionTime).toISOString().replace("T", " ").slice(0, 16) +
                  " UTC"
                : "Move the crosshair, then click"}
              <span>
                {replay.dataset
                  ? "Only revealed candles can be selected. Future candles stay hidden."
                  : "Click to begin a bounded replay session."}
              </span>
            </div>
          )}
          {replay.loading && (
            <div className="replay-calculating" role="status">
              Preparing closed-candle state…
            </div>
          )}
        </div>
        <BarReplayControls state={replay} host={hostRef.current} />
      </div>
      {replay.tradeOpen && <ReplayTradingPanel state={replay} host={hostRef.current} />}
    </div>
  );
}
