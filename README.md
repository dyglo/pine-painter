# Pine Painter

Build a web app for creating and testing TradingView Pine Script indicators on a chart.

Base: LuxAlgo's open-source Vela (@luxalgo/vela, @luxalgo/vela/workspace, @luxalgo/vela-pinets, pinets).
Data: Use Vela's bundled data providers (e.g. Binance/Coinbase) and its workspace symbol and timeframe controls.

Features:

1. Full-screen Vela workspace chart.
2. Code editor with a Run button: executes Pine Script via chart.runIndicator / chart.addIndicator (using @luxalgo/vela-pinets / pinets) and plots the result on the chart. Show Vela's structured errors inline if compilation or execution fails.
3. AI assistant panel: Describe an indicator in plain language. The model writes Pine v5/v6, and the app compiles and executes it on the chart. Automatic recovery sends actual chart diagnostics and unsuccessful candidates back to the model, tries targeted patches, then changes strategy to diagnosis and a compatible rewrite. Generation runs in a server function through Lovable's Responses gateway, keeping API keys on the server. Default: GPT-6.1 Sol; alternative: GPT-6 Luna.
4. Copy Pine button in the editor toolbar so code can be easily copied and pasted into TradingView.

Out of scope: strategy(), backtesting, accounts, payments, extra pages. Keep it simple and focused.

## Recovery controls

Expand **Recovery settings and details** below the composer to configure each task's spending, time, token, and call limits. Defaults: $1 estimated spend, 180 seconds, 60,000 total tokens, and a 40-call safety ceiling. Cancel stops future calls immediately and discards chart results that arrive after cancellation. Failed candidates never replace the last working indicator. Only successful Vela compilation/runtime execution and chart application produce the success message.

Each internal attempt records code, diagnostics, strategy, token usage and estimated USD cost. The gateway catalog verified on 2026-10-15 lists `openai/gpt-6.1-sol` and `openai/gpt-6-luna` with Responses support. Standard input/output rates per million tokens are $2/$10 and $0.10/$0.50 respectively. Preflight reservations use the higher long-context rates and a conservative UTF-8 input token bound; output tokens are capped to fit the remaining allowance. Cached-token discounts are not deducted. Update the rate table in `src/lib/ai/recovery.ts` when gateway pricing changes. Estimates are not a provider billing guarantee or an account-wide spending cap.

Exact repeated failed candidates are rejected before recompilation. Three rejected repeats stop a stalled task. Missing usage or lost responses reserve conservative usage and stop further recovery to avoid unaccounted spending. Rate-limit, billing, and transport failures stop with resumable context instead of issuing unbounded network retries.

Recovery runs asynchronously in the current browser session, including while the side panel is collapsed. It is not a durable server job and stops when the workspace unmounts. Code and diagnostics stay in the editor and recovery details; **Resume with new budget** explicitly starts another bounded run retaining the failure history. **Export code and diagnostics** saves a JSON record before closing the session. No accounts or automatic persistent storage are added.

Verification uses the installed Vela/PineTS engine and current chart data, not TradingView's proprietary compiler. It does not prove indicator logic, trading profitability, or compatibility with all future live bars. A synchronous engine call that blocks the browser cannot be preempted by an AbortSignal; asynchronous late results are guarded and removed.

Run `npm test`, `npx tsc --noEmit`, and `npm run build` for offline checks. An optional billable smoke test in `src/test/pine-live.test.ts` exercises both real gateway models and offline PineTS execution: set `PINE_LIVE_TEST=1` and supply `LOVABLE_API_KEY` in the test environment. The ordinary test suite skips this call.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b1c423fc-5c62-4ab7-8ce0-ea87cb0f59ec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Native Bar Replay

Use **Enter Replay** in the chart toolbar, selecting the **close time in UTC** of the last candle you want revealed. The app snapshots up to 500 following candle intervals, plus a bounded history window, from the selected existing provider. At least 200 warm-up candles are required. Missing intervals remain gaps; the coverage count and dataset fingerprint appear in the toolbar. Loading failures leave the live chart intact.

The supplied HTML workspace provides Replay/Select bar, play/pause, next/final, calendar date seeking, and 1/3/10/30× requested speed on complete candles. The exact 2419 × 1512 design stage scales to the available chart viewport. Each analytical state waits for static indicator calculation; speed slows down rather than skipping calculations. Completion remains frozen. **Exit Replay** is the only control that recreates a live subscription. The current indicator survives exit. Native drawings persist through replay steps; pre-replay drawings return on exit.

Replay uses the same native VelaWorkspace/WorkspaceReplay/ReplayControl renderer. For isolation, each state is staged in a hidden native workspace with a unique provider/cache namespace and published only after its calculations succeed. Existing provider implementations and the indicator AI/recovery runner are unchanged. Replay feeds are immutable, non-streaming snapshot adapters. Pine executions use fresh static contexts; the secondary gateway never reads the live feed or Vela cache. Same-symbol higher resolutions are aggregated from revealed constituent candles only; incomplete buckets are omitted. This conservative V1 uses UTC aggregation, not provider-specific session-aligned HTF candles.

**Supported boundary:** fixed UTC time resolutions; standard candle prices; deterministic indicators; same-symbol secondary resolutions that are integer multiples of the dataset resolution. Cross-symbol requests, finer secondary resolutions, ticker modifiers, calendar resolutions, `lookahead_on`, `timenow`, `math.random`, external request methods, viewport-dependent Pine studies and restored viewport-dependent native studies fail closed. OANDA source replay supports 5m/15m/1h; 4h/daily need verified session/DST close metadata. Intrabar/tick replay and multi-chart replay are not implemented. A separate deterministic paper engine supports Market/Limit/Stop/Stop Limit, protective exits, cancellation and closing; it never sends broker orders. This is a trusted-indicator runtime, not a sandbox for hostile JavaScript.

**Restore session** validates the full stored dataset SHA-256 identity, coverage, engine versions and cursor before restoring paused (or frozen at the end). Browser localStorage contains the dataset, symbol metadata, chart cosmetics, drawings, native studies and indicator source/input/prop snapshots. Nothing is refetched for analytical replay. Storage failure is reported; there is no cloud sync. Editor/conversation/recovery state remains owned by the existing agent and is not restored by replay. Restored chart scripts therefore do not overwrite the editor. Do not treat saved annotation knowledge as a blind-trading experiment.

The verified engine matrix is the unchanged `bun.lock`: Vela 0.8.3, vela-pinets 0.2.15, PineTS 0.11.0. Build-time version detection disables replay for other versions until the correctness suite is rerun and the matrix deliberately updated. Install with `bun install --frozen-lockfile`; an unconstrained `npm install` can otherwise resolve newer compatible ranges. No dependency manifest or lockfile version changes were needed.

### Replay verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `NITRO_PRESET=vercel npm run build`. Replay tests use the real Pine engine for finite-valued primary/HTF outputs, compare against clean prefix-only runs, mutate future suffixes, exercise native ReplayControl, and cover cache isolation, calculation races, warm-up/gaps, frozen completion and session integrity. The existing billable AI smoke test remains opt-in.

A repeatable browser acceptance script intercepts provider HTTP/WebSocket traffic with a deterministic historical fixture; it makes no AI or OANDA calls and adds no fixture endpoint to the shipped app. It also compares the supplied HTML against React at identical viewport sizes and drags native SL drawings. The browser tool requires Python 3 with Pillow for screenshot inspection (test tooling only). To run it without adding project dependencies:

```sh
npm install --prefix /tmp/deplyze-replay-tools --no-save playwright
NITRO_PRESET=node-server npm run build
PORT=3000 node .output/server/index.mjs
# In another shell; point CHROMIUM_PATH at an installed Chromium if needed:
PLAYWRIGHT_MODULE=/tmp/deplyze-replay-tools/node_modules/playwright/index.mjs node scripts/verify-replay.mjs http://localhost:3000
python3 scripts/compare-html-screenshots.py /tmp/deplyze-replay-artifacts
```

Screenshots default to `/tmp/deplyze-replay-artifacts`; set `REPLAY_ARTIFACTS_DIR` to override. Browser acceptance verifies the toolbar, step/play/pause/speed, frozen completion, restoration, successful indicator replacement after restoration, explicit exit, zero new history requests/sockets during replay and absence of page errors. It verifies deterministic integration, not real-account historical availability. Test real OANDA access separately with the deployed account.

The V1 isolation strategy rebuilds native workspace state per analytical candle. This favors correctness over throughput; expensive synchronous Pine cannot be preempted by a JavaScript timeout. The 5,000-interval dataset ceiling and calculation barrier bound ordinary sessions, but this is not a tick-speed backtest engine. No claims of profitability, tick-path accuracy, or TradingView compiler equivalence are made.

### Third-party licensing

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). A visible **Charts by Vela** link is present on the chart screen. Vela core is Apache-2.0 with its shipped attribution NOTICE; vela-pinets and PineTS are AGPL-3.0-only. Corresponding-source, combined-work, redistribution and any commercial-license obligations remain unresolved for a closed-source commercial release. Provider historical-storage/display/redistribution terms also require separate review. This implementation does not change or relicense those dependencies.
