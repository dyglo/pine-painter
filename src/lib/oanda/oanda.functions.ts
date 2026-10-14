import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OANDA_GRANULARITIES, OANDA_INSTRUMENTS, type Bar } from "./oanda-shared";

type Result = { ok: true; bars: Bar[] } | { ok: false; message: string };

const base = z.object({
  instrument: z.enum(OANDA_INSTRUMENTS),
  granularity: z.enum(OANDA_GRANULARITIES),
});

function fail(e: unknown): Result {
  const msg = e instanceof Error && e.name === "Error" ? e.message : "OANDA request failed";
  return { ok: false, message: e instanceof Error ? e.message || msg : msg };
}

export const getOandaCandles = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    base
      .extend({
        from: z.number().optional(),
        to: z.number().optional(),
        limit: z.number().int().positive().max(20000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Result> => {
    const { fetchHistory } = await import("./oanda.server");
    try {
      return {
        ok: true,
        bars: await fetchHistory(data.instrument, data.granularity, {
          from: data.from,
          to: data.to,
          limit: data.limit,
        }),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const getOandaLatest = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }): Promise<Result> => {
    const { fetchLatest } = await import("./oanda.server");
    try {
      return { ok: true, bars: await fetchLatest(data.instrument, data.granularity) };
    } catch (e) {
      return fail(e);
    }
  });
