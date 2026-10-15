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
