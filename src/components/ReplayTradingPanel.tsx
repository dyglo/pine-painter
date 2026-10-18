import { useState } from "react";
import { X } from "lucide-react";
import type { ReplayHost, ReplayHostView } from "@/lib/replay/workspace";
import { COSTS, validateOrder, type OrderInput } from "@/lib/replay/trading";
const money = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 5 });
export function ReplayTradingPanel({
  state,
  host,
}: {
  state: ReplayHostView;
  host: ReplayHost | null;
}) {
  const [side, setSide] = useState<OrderInput["side"]>("buy");
  const [type, setType] = useState<OrderInput["type"]>("market");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const d = state.dataset,
    view = state.view,
    trading = state.trading;
  const mark = d && view ? d.bars[view.cursor]!.close : 0;
  const order: OrderInput = {
    side,
    type,
    quantity: Number(quantity),
    ...(type !== "market" ? { price: Number(price) } : {}),
    ...(sl ? { stopLoss: Number(sl) } : {}),
    ...(tp ? { takeProfit: Number(tp) } : {}),
  };
  let invalid = "";
  try {
    validateOrder(order, mark);
  } catch (e) {
    invalid = (e as Error).message;
  }
  const settled = !!d && !!view && !state.loading && ["paused", "ended"].includes(view.status);
  const canSubmit =
    settled &&
    view?.status !== "ended" &&
    !!trading &&
    !trading.pending &&
    !trading.position &&
    !invalid;
  return (
    <aside className="replay-trade-panel" aria-label="Replay Trading">
      <header>
        <div>
          <strong>{d?.symbol.split(":").at(-1) ?? "Replay Trading"}</strong>
          <span>SIMULATED · REPLAY ONLY</span>
        </div>
        <button type="button" aria-label="Close trading panel" onClick={() => host?.toggleTrade()}>
          <X size={18} />
        </button>
      </header>
      <div className="replay-trade-scroll">
        <div className="trade-sides">
          {(["sell", "buy"] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={`${value} ${side === value ? "selected" : ""}`}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
            >
              <strong>{value === "buy" ? "Buy" : "Sell"}</strong>
              <span>{mark ? money(mark) : "—"}</span>
            </button>
          ))}
        </div>
        <div className="trade-order-types" role="group" aria-label="Order type">
          {(["market", "limit", "stop"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) host?.trade(order);
          }}
        >
          <label>
            Quantity · base units
            <input
              aria-label="Order quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          {type !== "market" && (
            <label>
              {type === "limit" ? "Limit price" : "Stop price"}
              <input
                aria-label="Order price"
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          )}
          <div className="trade-bracket">
            <label>
              Stop loss
              <input
                aria-label="Stop loss"
                type="number"
                step="any"
                placeholder="Optional"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
              />
            </label>
            <label>
              Take profit
              <input
                aria-label="Take profit"
                type="number"
                step="any"
                placeholder="Optional"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
              />
            </label>
          </div>
          <h3>Order info</h3>
          <dl>
            <dt>Replay close</dt>
            <dd>{mark ? money(mark) : "—"}</dd>
            <dt>Trade value · quote units</dt>
            <dd>{mark && Number(quantity) > 0 ? money(mark * Number(quantity)) : "—"}</dd>
            <dt>Earliest fill</dt>
            <dd>Next revealed candle</dd>
          </dl>
          <button className={`trade-submit ${side}`} type="submit" disabled={!canSubmit}>
            {side === "buy" ? "Buy" : "Sell"} · {quantity || "0"} {type.toUpperCase()}
            <small>Paper order · no broker connection</small>
          </button>
          <p className="trade-hint">
            {!d
              ? "Enter Replay to trade historical prices."
              : view?.status === "ended"
                ? "Replay complete. No further fills until you rewind."
                : !settled
                  ? "Pause and wait for calculations to place an order."
                  : trading?.position || trading?.pending
                    ? "Close the position or cancel the pending order first."
                    : invalid || "Order activates after this candle closes."}
          </p>
        </form>
        <h3>Position & orders</h3>
        <p>
          {trading?.position
            ? `${trading.position.side.toUpperCase()} ${trading.position.quantity} @ ${money(trading.position.entry)}`
            : "Flat · no open position"}
        </p>
        {trading?.pending && (
          <p>
            Pending:{" "}
            {typeof trading.pending === "string"
              ? "Close"
              : `${trading.pending.side} ${trading.pending.type}`}
          </p>
        )}
        <div className="trade-actions">
          {trading?.pending && (
            <button disabled={!settled} onClick={() => host?.trade("cancel")}>
              Cancel pending
            </button>
          )}
          {trading?.position && !trading.pending && (
            <button
              disabled={!settled || view?.status === "ended"}
              onClick={() => host?.trade("close")}
            >
              Close at next open
            </button>
          )}
        </div>
        <dl>
          <dt>Realized · after fees</dt>
          <dd>{money(trading?.realized ?? 0)}</dd>
          <dt>Unrealized · at close</dt>
          <dd>{money(trading?.unrealized ?? 0)}</dd>
          <dt>Commission paid</dt>
          <dd>{money(trading?.fees ?? 0)}</dd>
        </dl>
        <h3>Execution history</h3>
        <ol className="trade-fills">
          {trading?.fills
            .slice(-20)
            .reverse()
            .map((fill, i) => (
              <li key={`${fill.cursor}-${i}`}>
                <strong>
                  {fill.side.toUpperCase()} {fill.quantity} @ {money(fill.price)}
                </strong>
                <span>
                  {fill.reason} · bar {fill.cursor + 1}
                </span>
              </li>
            ))}
        </ol>
        <details className="trade-assumptions">
          <summary>Execution assumptions & costs</summary>
          <p>
            OHLC only. Full fills, one position, no leverage or funding. P&L stays in quote units;
            no currency conversion. Synthetic spread {COSTS.spreadBps} bps, adverse slippage{" "}
            {COSTS.slippageBps} bp and commission {COSTS.commissionBps} bp per fill. Limits never
            fill worse than their limit.
          </p>
          <p>
            Stops win when SL and TP touch the same bar. Entry-bar TP is deferred; entry-bar SL
            applies conservatively. Gaps fill at the next observed open when applicable; missing
            intervals have no invented prices. Exposed gaps: {trading?.gaps ?? 0}.
          </p>
          <p>
            Rewinding discards actions after the selected candle and rebuilds results. Replaying
            identical candles and actions gives identical results. Unrealized P&L excludes estimated
            exit costs.
          </p>
        </details>
      </div>
    </aside>
  );
}
