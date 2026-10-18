import type { ReplayDataset } from "./dataset";

export const TRADING_VERSION = 1;
export const COSTS = Object.freeze({ spreadBps: 2, slippageBps: 1, commissionBps: 1 });
export type OrderInput = {
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  quantity: number;
  price?: number;
  stopLoss?: number | undefined;
  takeProfit?: number | undefined;
};
export type TradingAction = { cursor: number; order: OrderInput | "close" | "cancel" };
export type TradingTape = { version: 1; start: number; actions: TradingAction[] };
export type Fill = {
  cursor: number;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  fee: number;
  reason: string;
};
export type Position = {
  side: "buy" | "sell";
  quantity: number;
  entry: number;
  stopLoss?: number | undefined;
  takeProfit?: number | undefined;
};
export type TradingState = {
  position: Position | null;
  pending: OrderInput | "close" | null;
  fills: Fill[];
  realized: number;
  unrealized: number;
  fees: number;
  gaps: number;
};

export function validateOrder(order: OrderInput, mark: number) {
  if (
    !["buy", "sell"].includes(order.side) ||
    !["market", "limit", "stop"].includes(order.type) ||
    !Number.isFinite(order.quantity) ||
    order.quantity <= 0 ||
    order.quantity > 1e9
  )
    throw new Error("Enter a valid side, order type and quantity (up to 1 billion base units).");
  const positive = (value: number | undefined) =>
    value == null || (Number.isFinite(value) && value > 0);
  if (
    ![order.price, order.stopLoss, order.takeProfit].every(positive) ||
    (order.type !== "market" && !order.price)
  )
    throw new Error("Order prices must be positive finite numbers.");
  const entry = order.type === "market" ? mark : order.price!;
  const direction = order.side === "buy" ? 1 : -1;
  if (
    (order.stopLoss != null && (order.stopLoss - entry) * direction >= 0) ||
    (order.takeProfit != null && (order.takeProfit - entry) * direction <= 0)
  )
    throw new Error(
      "Stop loss and take profit must be on the protective and profitable sides of the entry.",
    );
}

/** Reconstruct solely from the revealed prefix. Actions are placed AFTER cursor close;
 * fills start at the next observed bar. No account currency conversion or leverage. */
export function simulate(dataset: ReplayDataset, tape: TradingTape, cursor: number): TradingState {
  if (
    tape.version !== TRADING_VERSION ||
    !Number.isInteger(tape.start) ||
    tape.start < dataset.warmup ||
    tape.start > cursor ||
    cursor >= dataset.bars.length ||
    !Array.isArray(tape.actions) ||
    tape.actions.length > 10000
  )
    throw new Error("Invalid paper-trading session.");
  const s: TradingState = {
    position: null,
    pending: null,
    fills: [],
    realized: 0,
    unrealized: 0,
    fees: 0,
    gaps: 0,
  };
  let lastAction = tape.start;
  for (const action of tape.actions) {
    if (!Number.isInteger(action.cursor) || action.cursor < lastAction || action.cursor > cursor)
      throw new Error("Invalid paper-trading action clock.");
    lastAction = action.cursor;
  }
  const execute = (
    raw: number,
    side: "buy" | "sell",
    quantity: number,
    i: number,
    reason: string,
    limit?: number,
  ) => {
    const direction = side === "buy" ? 1 : -1;
    let price = raw * (1 + (direction * (COSTS.spreadBps / 2 + COSTS.slippageBps)) / 10000);
    if (limit != null) price = side === "buy" ? Math.min(price, limit) : Math.max(price, limit);
    const fee = (price * quantity * COSTS.commissionBps) / 10000;
    s.fees += fee;
    s.realized -= fee;
    s.fills.push({ cursor: i, side, price, quantity, fee, reason });
    return price;
  };
  const close = (raw: number, i: number, reason: string, limit?: number) => {
    const p = s.position!;
    const price = execute(raw, p.side === "buy" ? "sell" : "buy", p.quantity, i, reason, limit);
    s.realized += (price - p.entry) * p.quantity * (p.side === "buy" ? 1 : -1);
    s.position = null;
  };
  let actionIndex = 0;
  for (let i = tape.start; i <= cursor; i++) {
    const b = dataset.bars[i]!;
    if (i > tape.start) {
      if (b.time !== dataset.bars[i - 1]!.time + dataset.interval && (s.pending || s.position))
        s.gaps++;
      if (s.pending === "close") {
        if (s.position) close(b.open, i, "Close at next open");
        s.pending = null;
      } else if (s.pending) {
        const o = s.pending;
        const buy = o.side === "buy";
        const hit =
          o.type === "market" ||
          (o.type === "limit"
            ? buy
              ? b.low <= o.price!
              : b.high >= o.price!
            : buy
              ? b.high >= o.price!
              : b.low <= o.price!);
        if (hit) {
          const raw =
            o.type === "market"
              ? b.open
              : o.type === "limit"
                ? buy
                  ? Math.min(b.open, o.price!)
                  : Math.max(b.open, o.price!)
                : buy
                  ? Math.max(b.open, o.price!)
                  : Math.min(b.open, o.price!);
          const entry = execute(
            raw,
            o.side,
            o.quantity,
            i,
            `${o.type} entry`,
            o.type === "limit" ? o.price : undefined,
          );
          s.position = {
            side: o.side,
            quantity: o.quantity,
            entry,
            stopLoss: o.stopLoss,
            takeProfit: o.takeProfit,
          };
          s.pending = null;
        }
      }
      if (s.position) {
        const p = s.position;
        const buy = p.side === "buy";
        const stop = p.stopLoss != null && (buy ? b.low <= p.stopLoss : b.high >= p.stopLoss);
        const profit =
          p.takeProfit != null && (buy ? b.high >= p.takeProfit : b.low <= p.takeProfit);
        // Conservative ambiguity policy: stop wins, including entry bar. Do not
        // credit entry-bar TP (its high/low may have occurred before entry).
        const enteredHere =
          s.fills.at(-1)?.cursor === i && s.fills.at(-1)?.reason.endsWith("entry");
        if (stop)
          close(
            buy ? Math.min(b.open, p.stopLoss!) : Math.max(b.open, p.stopLoss!),
            i,
            "Stop loss · adverse first",
          );
        else if (profit && !enteredHere)
          close(
            buy ? Math.max(b.open, p.takeProfit!) : Math.min(b.open, p.takeProfit!),
            i,
            "Take profit",
            p.takeProfit,
          );
      }
    }
    while (actionIndex < tape.actions.length && tape.actions[actionIndex]!.cursor === i) {
      const action = tape.actions[actionIndex++]!.order;
      if (action === "cancel") s.pending = null;
      else if (action === "close") {
        if (!s.position || s.pending) throw new Error("No available position to close.");
        s.pending = "close";
      } else {
        validateOrder(action, b.close);
        if (s.position || s.pending)
          throw new Error(
            "Only one position or pending entry is supported. Close or cancel first.",
          );
        s.pending = { ...action };
      }
    }
  }
  if (s.position)
    s.unrealized =
      (dataset.bars[cursor]!.close - s.position.entry) *
      s.position.quantity *
      (s.position.side === "buy" ? 1 : -1);
  return s;
}
