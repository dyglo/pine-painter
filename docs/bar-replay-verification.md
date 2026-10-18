# Native Bar Replay verification

Implemented against the existing locked Vela 0.8.3, vela-pinets 0.2.15 and PineTS 0.11.0. No dependency versions, indicator-agent/recovery logic, provider logic, credentials or production settings were changed. OANDA helper/test edits only resolve pre-existing formatting errors.

## Safety boundary

- The historical tape is bounded, copied, validated, deeply frozen and identified by SHA-256, including source symbol metadata, requested coverage, actual coverage/gaps and warm-up policy.
- A session's market clock is the selected candle's close in epoch milliseconds. Partial candles are excluded. Higher-timeframe results include only complete, contiguous UTC constituent buckets.
- Every analytical state uses native VelaWorkspace/WorkspaceReplay replay in a staged workspace with `live:false` and a non-streaming snapshot provider. Fresh per-state provider namespaces prevent native/drawing cache reuse; previous global cache namespaces are retired when the single active chart swaps.
- Pine calculations run fresh static contexts over a prefix, with a snapshot-only secondary gateway. No live provider or shared-cache callback is passed into those calculations. Cross-symbol/finer/unsupported requests fail explicitly. Models from failed/stopped/superseded executions are never published.
- The clock scheduler waits for calculation completion and atomically publishes the staged native workspace. It intentionally does not use native timed `play`, which cannot await analytical work. Previous/next use native seek reconstruction; no second chart renderer was introduced.
- Final completion has no live connection to restore. Explicit Exit Replay recreates the original live provider configuration and keeps the latest accepted indicator.
- The indicator agent's original runner is unchanged. Handle indirection preserves successful replacement and cancellation after native rebuilds and session restoration. Compilation pauses replay and waits for a pending state to settle.
- Persistence validates dataset identity, coverage, cursor and engine versions before restoring. It stores relevant chart state and chart indicator scripts; it does not change the agent/editor/conversation persistence model.

An upstream PineTS negative-path issue was reproduced: a rejected data-loader promise can hang and emit an unhandled rejection. The adapter signals the error through Vela, closes the calculation barrier, stops execution, returns an empty internal answer and suppresses every model from that failed run. The real-engine negative test remains in the suite and passes without unhandled rejections.

## Checks

- `npm test`: **43 passed**, including **14 replay/native/handle tests**. The one existing billable AI smoke test remains opt-in and was not run.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, with 15 existing Fast Refresh warnings and no errors.
- `NITRO_PRESET=vercel npm run build`: passed.
- Production Nitro build + Chromium browser acceptance: passed. Date selection, previous/next, play/pause, speed, progress, frozen completion, restoration, successful indicator replacement after restoration, and explicit exit were exercised. No page errors, new history requests or new sockets occurred during analytical replay.
- The engine oracle asserts finite outputs and a known HTF value, compares complete replay models with clean prefix-only models, and mutates future OHLC suffixes. It does not accept empty/NaN-only comparisons as proof.
- Native ReplayControl integration confirms prefix rendering and final completion without a subscription.
- Source checks confirm the AI agent files and package manifest/lockfile are unchanged.

Browser verification uses intercepted deterministic Binance-format historical data, not a production fixture endpoint or a billable API. Screenshots demonstrate this fixture. It does not certify OANDA account entitlement or historical feed accuracy. The acceptance script is `scripts/verify-replay.mjs`; setup and commands are in README.

## Explicit limitations and remaining gates

- V1 is single-chart, closed-candle replay, not tick reconstruction or a trading simulator. Speed is a requested pace constrained by actual calculation time; no analytical candles are skipped.
- Source OANDA replay is enabled for 5m/15m/1h. Its 4h/daily candle close/session/DST metadata is not sufficient to certify replay, so those resolutions fail closed. Original live feeds remain available unchanged.
- Higher-timeframe data is UTC-aggregated from the immutable base dataset. Provider-session-aligned HTF bars, calendar resolutions, finer secondary data, cross-symbol datasets and ticker modifiers are not supported.
- Nondeterministic/external/lookahead capabilities and viewport-dependent studies are rejected conservatively. This is not a sandbox for hostile JavaScript, nor a claim that every Pine Script construct is supported.
- Synchronous Pine work cannot be interrupted by a JavaScript timeout. Large/expensive scripts may block the tab; repeated workspace construction prioritizes isolation over throughput. Browser/device profiling remains necessary before raising the 5,000-interval ceiling or advertising high-speed backtesting.
- Restore is local to browser storage; storage denial/quota errors are reported. Saved chart scripts do not overwrite the agent's editor or conversation. User annotations can encode prior knowledge; they are not a lookahead-safe trading simulation ledger.
- Development-server browser smoke encountered a React optimizer duplicate-runtime/hook error in this environment. Browser acceptance therefore ran against the shipping production Nitro bundle, which passed. No dependency upgrade or unrelated dev-toolchain workaround was shipped.
- Vela attribution is visible and package licenses/notices are included. AGPL corresponding-source/combined-work obligations and market-data storage/display/redistribution rights remain commercial-release review items. No commercial exception or application relicensing is implied.

Unsupported engine versions disable Enter/Restore Replay until the version matrix and acceptance evidence are deliberately updated. Unsupported data/calculation capabilities leave the session unadvanced, with an explicit error; no fallback to live data occurs.

## Bar Replay V2 — native workspace UX and paper trading

The main native Vela topbar now has Replay and Trade actions. Replay enables the native crosshair selection guide; the UTC open timestamp is repeated in the selection banner, and clicking/tapping a revealed candle seeks its closed state. Hidden future candles remain unavailable for picking. The bottom transport retains UTC date selection as an alternative, speed, previous/next, progress, restore and explicit exit. Date controls collapse after use. The docked right-hand trading panel resizes the same native chart. Drawings and the visible range now survive replay steps; existing live drawings also carry into replay (they can encode prior knowledge, as above).

`src/lib/replay/trading.ts` is an independent, versioned, deterministic OHLC simulator. It has no broker imports or order endpoints. Orders are recorded after a closed candle and first become eligible on the next observed candle. Market, Limit and Stop entries support one position or one pending entry, with optional stop loss/take profit, cancellation, and next-open position closing. The UI disables submissions while live, calculating, playing, at completion, or with invalid/unsupported position state. Failure is reported instead of inventing results.

Execution assumptions (also visible in the panel):

- Quantities are base units and P&L is quote units, without account-currency conversion, leverage, margin, funding, liquidity limits or partial fills.
- Every fill includes a synthetic 2 bp full spread, 1 bp adverse slippage and 1 bp commission. These are explicit modeling assumptions, not measured broker costs. Limits cap adverse execution at the limit, while allowing favorable gap-open execution. Stops gap through to the observed open.
- When both protective exits touch within an OHLC candle, stop loss wins. Entry-bar stop loss applies conservatively; entry-bar take profit is deferred because the high/low may predate entry. This is a pessimistic convention, not a reconstruction of tick chronology.
- No candles/prices are invented for missing intervals. Orders and stops can gap through at the next observed open; the panel counts gaps traversed with exposure. Results across missing history require caution.
- Unrealized P&L uses only the current revealed close and excludes prospective exit costs. Realized P&L deducts commissions.
- Seeking forward processes all intermediate revealed bars. Rewinding discards actions after the destination, retains actions at that close, and recomputes the ledger. Identical dataset/actions produce identical outputs independent of playback speed. The versioned action history is saved alongside V1 dataset identity/engine versions and validated on restore. Old V1 saves start with an empty paper ledger.

V2 tests add prefix-only/suffix-mutation equivalence for fills/P&L, submission timing/cost arithmetic, buy/sell limit/stop gap behavior, SL/TP ambiguity, cancellation/closing, JSON restoration, invalid action clocks/orders, and missing intervals. Existing V1 engine/native/race/frozen/session tests remain enabled. Browser acceptance additionally exercises native chart picking, active Replay chrome, real paper entry/next-bar fills/closing, responsive docking and restored indicator replacement. Screenshots use the deterministic fixture, not real broker executions.

Licensing notices and visible Vela attribution remain intact. Previously recorded AGPL and market-data commercial redistribution obligations remain unresolved; this change grants no additional rights. Source feed restrictions and the 5,000-bar bound remain unchanged. Native workspace reconstruction still limits maximum practical speed, and trading history is local to this browser session storage.

V2 release verification: `npm test` **49 passed**, one unrelated opt-in billable AI smoke test skipped; TypeScript passed; lint passed with the same 15 existing warnings; both Node production and Vercel production builds passed. Chromium acceptance passed with no page errors, no history requests or sockets during replay, successful chart picking, unchanged canvas identity when docking, and a usable chart at 900px viewport width. Replay entry/fill/close, playback/freeze, restore, indicator replacement and explicit live exit all passed. Expected console network errors are the fixture's deliberately blocked external font requests.
