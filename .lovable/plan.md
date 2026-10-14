# Add OANDA forex and gold data

## What you get
- The chart's symbol picker shows all the current crypto symbols plus **EUR_USD, GBP_USD, USD_JPY, USD_CAD, XAU_USD**.
- These five run on timeframes **5m, 15m, 1h, 4h, 1D**, so your indicators can be tested on forex and gold.
- Binance and Coinbase work exactly as they do now.
- A secure form where you paste your OANDA practice API key. It's stored on the server and never sent to the browser.

## How it works
1. **Key placeholder**: a secret named `OANDA_API_TOKEN` (practice account). You add it through a secure form after approving this plan. Until it's added, choosing an OANDA symbol shows the message "OANDA key not configured".
2. **Server-only calls**: the app talks to OANDA (`api-fxpractice.oanda.com`) only from server code, using midpoint candles.
3. **History**: older candles load in pages of up to 5000. Each page is kept in a short-lived server cache (keyed by symbol, timeframe and range) so scrolling back and reloading stay fast and use fewer OANDA requests.
4. **Live**: every 5 seconds the chart asks for the latest few candles and updates the current candle or adds a new one. No streaming connection.
5. **Chart**: a custom OANDA provider is registered next to the Binance and Coinbase providers.

## Technical details
- `src/lib/oanda/oanda.server.ts`: fetch helper (Bearer token read inside the handler, `price=M`, `granularity` map M5/M15/H1/H4/D, `from`/`to`/`count<=5000`, paging loop, only `complete` candles in history, plus the last open candle for live updates). Cache uses a module-level LRU Map with a TTL that depends on the timeframe (closed history pages are cached longer, the latest page about 4s). Note: Worker isolates are per instance, so the cache is best-effort.
- `src/lib/oanda/oanda.functions.ts`: `createServerFn` `getOandaCandles({ instrument, granularity, from?, to?, limit })` and `getOandaLatest({ instrument, granularity })`, validated with zod against the allowlist (5 instruments, 5 granularities). Returns plain OHLCV DTOs (time in ms). Errors come back as `{ ok:false, message }`, and the token is never echoed.
- `src/lib/oanda/oanda-provider.ts` (browser-safe): a class implementing Vela's provider interface, shaped like the bundled BinanceProvider (symbol list, timeframe list, history fetch, subscribe). Subscribe is a `setInterval(5000)` that calls `getOandaLatest` and returns an unsubscribe that clears the timer. Vela timeframe ids are mapped to OANDA granularities ("5"→M5, "15"→M15, "60"→H1, "240"→H4, "1D"→D).
- `ChartWorkspace.tsx`: add `oanda: () => new OandaProvider()` to `providers`, so the picker lists OANDA symbols next to the crypto ones. Nothing else changes.
- Tests: a unit test for the granularity map, OANDA candle → OHLCV conversion, and the paging boundaries.
- Record the provider rule in AGENTS.md.

## Out of scope
Live (non-practice) accounts, streaming prices, bid/ask candles, other instruments.
