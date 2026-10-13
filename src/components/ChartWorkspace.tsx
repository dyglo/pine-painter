import { useEffect, useRef } from "react";

export type RunOutcome = { ok: true } | { ok: false; error: string };

export type ChartApi = {
  run: (code: string) => Promise<RunOutcome>;
};

function formatError(err: unknown): string {
  if (!err) return "Unknown error";
  const e = err as Record<string, unknown> & Error;
  const parts = [e.message || String(err)];
  const line = e.line ?? (e.loc as { line?: number } | undefined)?.line;
  const col = e.column ?? (e.loc as { column?: number } | undefined)?.column;
  if (line != null) parts.unshift(`Line ${line}${col != null ? `:${col}` : ""}`);
  return parts.join(" — ");
}

export function ChartWorkspace({ onReady }: { onReady: (api: ChartApi) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let ws: { chart: any; destroy: () => void } | null = null;
    let handle: { remove: () => void } | null = null;

    (async () => {
      const [{ VelaWorkspace }, { BinanceProvider }, { CoinbaseProvider }, { PineEngine }] =
        await Promise.all([
          import("@luxalgo/vela/workspace"),
          import("@luxalgo/vela/providers/binance"),
          import("@luxalgo/vela/providers/coinbase"),
          import("@luxalgo/vela-pinets"),
        ]);
      if (disposed || !ref.current) return;
      ws = new VelaWorkspace(ref.current, {
        layout: false,
        symbol: "BTCUSDT",
        timeframe: "60",
        live: true,
        theme: "dark",
        providers: {
          binance: () => new BinanceProvider(),
          coinbase: () => new CoinbaseProvider(),
        },
        engines: { pine: () => new PineEngine() },
      } as any) as any;

      onReady({
        run: async (code) => {
          if (!ws) return { ok: false, error: "Chart not ready" };
          try {
            handle?.remove();
          } catch {
            /* already gone */
          }
          handle = null;
          try {
            const res = await ws.chart.runIndicator(code, { language: "pine" });
            if (res.ok) {
              handle = res.handle;
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
