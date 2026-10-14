import { useEffect, useRef } from "react";

export type RunOutcome = { ok: true } | { ok: false; error: string };

export type ChartApi = {
  run: (code: string) => Promise<RunOutcome>;
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

  useEffect(() => {
    let disposed = false;
    let ws: InstanceType<typeof import("@luxalgo/vela/workspace").VelaWorkspace> | null = null;
    let handle: { remove: () => void } | null = null;

    (async () => {
      const [
        { VelaWorkspace },
        { BinanceProvider },
        { CoinbaseProvider },
        { PineEngine },
        { OandaProvider },
      ] = await Promise.all([
        import("@luxalgo/vela/workspace"),
        import("@luxalgo/vela/providers/binance"),
        import("@luxalgo/vela/providers/coinbase"),
        import("@luxalgo/vela-pinets"),
        import("@/lib/oanda/oanda-provider"),
      ]);
      if (disposed || !ref.current) return;
      const tokens = getComputedStyle(ref.current);
      const token = (name: string) => tokens.getPropertyValue(name).trim();
      ws = new VelaWorkspace(ref.current, {
        layout: false,
        symbol: "BTCUSDT",
        timeframe: "60",
        live: true,
        theme: {
          background: token("--background"),
          textColor: token("--muted-foreground"),
          gridColor: token("--card"),
          borderColor: token("--border"),
          upColor: token("--success"),
          downColor: token("--destructive"),
          fontFamily: token("--font-sans"),
        },
        providers: {
          binance: () => new BinanceProvider(),
          coinbase: () => new CoinbaseProvider(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oanda: () => new OandaProvider() as any,
        },
        engines: { pine: () => new PineEngine() },
      });

      onReady({
        run: async (code) => {
          if (!ws) return { ok: false, error: "Chart not ready" };
          try {
            const res = await ws.chart.runIndicator(code, { language: "pine" });
            if (res.ok) {
              const previous = handle;
              handle = res.handle;
              try {
                previous?.remove();
              } catch {
                /* Already removed. */
              }
              return { ok: true };
            }
            return { ok: false, error: formatError(res.error) };
          } catch (err) {
            return { ok: false, error: formatError(err) };
          }
        },
      });
    })();

    return () => {
      disposed = true;
      ws?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="h-full w-full" />;
}
