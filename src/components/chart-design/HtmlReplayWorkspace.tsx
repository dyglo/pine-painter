import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import source from "./source.json";
import { fitStage, orderRisk, shiftedStyle, viewportStyle, type SourceNodeData } from "./layout";
import { RightSidebar } from "./RightSidebar";
import type { WorkspacePanel } from "../ChartWorkspace";
import { SourceNode, HitTarget } from "./SourceNode";
import { DrawingFlyout } from "./DrawingFlyout";
import { FLYOUT_GROUPS } from "./flyout-data";
import { TOOL_MAP, GROUPS, type GroupKey } from "./drawing-tools";
import { ReplayCalendar } from "./ReplayCalendar";
import { BRAND } from "@/lib/branding";
import { intervalOf } from "@/lib/replay/dataset";
import type { ReplayHost, ReplayHostView } from "@/lib/replay/workspace";
import { COSTS, validateOrder, type OrderInput } from "@/lib/replay/trading";
import "./source.css";
import "./workspace.css";

const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "–");
const signed = (v: number) => (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toFixed(2);
const types = ["market", "limit", "stop", "stop-limit"] as const;
const suffix = ["MKT", "LMT", "STP", "STP LMT"];
const toolIcons = source.icons as Record<string, string>;
const omitted = new Set([
  ...Array.from({ length: 26 }, (_, i) => 55 + i),
  ...Array.from({ length: 37 }, (_, i) => 89 + i),
]);
const HEADER = 76;

export function HtmlReplayWorkspace({
  state,
  host,
  chartRef,
  activePanel,
  onPanel,
  panelContent,
}: {
  state: ReplayHostView;
  host: ReplayHost | null;
  chartRef: RefObject<HTMLDivElement | null>;
  activePanel: WorkspacePanel;
  onPanel: (panel: WorkspacePanel) => void;
  panelContent: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.5, left: 0, top: 0, extraHeight: 0, extraWidth: 0 });
  const [drawingScroll, setDrawingScroll] = useState(0);
  const maxDrawingScroll = Math.max(0, 1330 - (1512 + fit.extraHeight - 72));
  const dockPixels = activePanel
    ? Math.min(
        activePanel === "code" ? 400 : 360,
        Math.max(0, (root.current?.clientWidth ?? 1366) - 320),
      )
    : 0;
  const dockWidth = dockPixels / fit.scale;
  const toolbarWidth = 2335 + fit.extraWidth - dockWidth;
  const toolbarRatio = Math.min(1, toolbarWidth / 2419);
  const toolbarPlace = (style: CSSProperties) => {
    const left = parseFloat(String(style.left));
    const width = parseFloat(String(style.width));
    const extra = toolbarWidth / toolbarRatio - 2419;
    return {
      ...style,
      ...(left >= 1700 ? { left: left + extra } : {}),
      ...(width === 2419 ? { width: width + extra } : {}),
    };
  };
  const place = (style: CSSProperties) => {
    const mapped = viewportStyle(style, fit.extraHeight, dockWidth, fit.extraWidth);
    const left = parseFloat(String(style.left));
    const top = parseFloat(String(style.top));
    if (left < 100 && top >= 90) {
      const y = top - Math.min(drawingScroll, maxDrawingScroll);
      return { ...mapped, top: y, visibility: y < 80 ? ("hidden" as const) : ("visible" as const) };
    }
    return mapped;
  };
  const [menu, setMenu] = useState(false),
    [menuPrice, setMenuPrice] = useState<number | null>(null),
    [calendar, setCalendar] = useState(false);
  const [fly, setFly] = useState<GroupKey | null>(null),
    [tool, setTool] = useState("cursor"),
    [favorites, setFavorites] = useState(new Set(["fibext", "pitch"]));
  const [side, setSide] = useState<"buy" | "sell">("buy"),
    [ot, setOt] = useState(0),
    [quantity, setQuantity] = useState("1"),
    [tp, setTp] = useState(""),
    [sl, setSl] = useState(""),
    [riskInput, setRiskInput] = useState(""),
    [orderPrice, setOrderPrice] = useState("");
  const [groupTools, setGroupTools] = useState<Record<GroupKey, string>>({
    lines: "trendline",
    fib: "fib-retracement",
    pattern: "xabcd-pattern",
    proj: "long-position",
    brush: "brush",
    text: "text",
    emoji: "emoji-0",
  });
  const [flash, setFlash] = useState("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = !!state.tradeOpen,
    replay = !!state.dataset || !!state.selecting,
    busy = state.loading || state.view?.status === "calculating";
  const playing = state.view?.status === "playing" || (busy && !!state.dataset),
    speed = state.view?.speed ?? 10;
  const bar = state.market?.bar,
    mark = bar?.close ?? 0,
    ticker = (state.market?.symbol ?? "BTCUSDT").split(":").at(-1)!.replaceAll("_", ""),
    tf = state.market?.timeframe ?? "60";
  const timeframe = tf === "60" ? "1h" : tf === "240" ? "4h" : /D/i.test(tf) ? "1D" : `${tf}m`;
  const p = state.trading?.position,
    quote = state.market?.quote ?? "USD",
    tick = state.market?.tick ?? 0.01;
  const entry = p?.entry ?? (ot === 0 ? mark : Number(orderPrice) || mark),
    q = p?.quantity ?? Math.max(1, Math.floor(Number(quantity) || 1));
  const risk = orderRisk(entry, Number(sl), Number(tp), q),
    sell = side === "sell";
  const priceText = (value: number) =>
    Number.isFinite(value)
      ? value.toFixed(
          Math.min(
            8,
            Math.max(
              2,
              Math.ceil(-Math.log10(tick)),
              ...[bar?.open, bar?.high, bar?.low, bar?.close].map(
                (value) => String(value ?? 0).split(".")[1]?.length ?? 0,
              ),
            ),
          ),
        )
      : "–";
  const stopInvalid =
      !!sl && ((p ? p.side === "sell" : sell) ? Number(sl) <= entry : Number(sl) >= entry),
    targetInvalid =
      !!tp && ((p ? p.side === "sell" : sell) ? Number(tp) >= entry : Number(tp) <= entry);
  const notify = (message: string) => {
    setFlash(message);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 1800);
  };
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setFit(fitStage(e.contentRect.width, e.contentRect.height));
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      clearTimeout(flashTimer.current);
    };
  }, []);
  useEffect(() => {
    if (state.drawingTool === null) setTool("cursor");
  }, [state.drawingTool]);
  useEffect(() => {
    if (p) {
      setSl(p.stopLoss == null ? "" : String(p.stopLoss));
      setTp(p.takeProfit == null ? "" : String(p.takeProfit));
    }
  }, [p]);
  const defaults = (s: "buy" | "sell", price = mark) => {
    if (p) return;
    const d = price * 0.005,
      L = s === "buy";
    setTp(priceText(L ? price + 2 * d : price - 2 * d));
    setSl(priceText(L ? price - d : price + d));
    setQuantity("1");
    setRiskInput("");
    setOrderPrice(priceText(price));
  };
  const openPanel = (s = side, type = ot, price = mark) => {
    setSide(s);
    setOt(type);
    if (!panel) host?.toggleTrade();
    defaults(s, price);
  };
  const pick = (id: string) => {
    setFly(null);
    setTool(id);
    const group = (Object.keys(GROUPS) as GroupKey[]).find((key) =>
      GROUPS[key].secs.some(([, rows]) => rows.some((r) => r[0] === id)),
    );
    if (group) setGroupTools((prev) => ({ ...prev, [group]: id }));
    if (TOOL_MAP[id]) host?.tools(TOOL_MAP[id]);
    else
      notify(
        `${String(
          Object.values(GROUPS)
            .flatMap((g) => g.secs.flatMap((s) => s[1]))
            .find((r) => r?.[0] === id)?.[1] ?? id,
        )} - coming in the next phase`,
      );
  };
  const changeProtection = (kind: "sl" | "tp", value: string) => {
    (kind === "sl" ? setSl : setTp)(value);
    if (p) {
      const next = {
        stopLoss: kind === "sl" ? Number(value) || undefined : p.stopLoss,
        takeProfit: kind === "tp" ? Number(value) || undefined : p.takeProfit,
      };
      try {
        validateOrder({ side: p.side, type: "market", quantity: p.quantity, ...next }, p.entry);
        host?.trade({ amend: next });
      } catch {
        /* Invalid drafts remain in the input until corrected; never reach execution. */
      }
    }
  };
  const submit = async () => {
    if (busy || playing) return;
    if (p) {
      notify("Close position first");
      return;
    }
    if (state.trading?.pending) {
      notify("Cancel pending order first");
      return;
    }
    const order: OrderInput = {
      side,
      type: types[ot]!,
      quantity: q,
      ...(ot ? { price: Number(orderPrice) } : {}),
      ...(ot === 3 ? { limitPrice: Number(orderPrice) + (side === "buy" ? tick : -tick) } : {}),
      ...(sl ? { stopLoss: Number(sl) } : {}),
      ...(tp ? { takeProfit: Number(tp) } : {}),
    };
    try {
      validateOrder(order, mark);
      if (!state.dataset) {
        const interval = intervalOf(tf);
        await host?.enter(
          Math.min(
            (bar?.time ?? Date.now()) + interval,
            Math.floor(Date.now() / interval) * interval,
          ),
        );
        host?.speed(10);
      }
      host?.trade(order);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const selectDate = async (time: number) => {
    setCalendar(false);
    if (state.dataset) {
      const cursor =
        state.dataset.bars.filter((b) => b.time + state.dataset!.interval <= time).length - 1;
      if (cursor >= state.dataset.warmup) await host?.seek(cursor);
      else notify("Date is outside the replay warm-up range");
    } else {
      await host?.enter(time);
      host?.speed(10);
    }
  };
  const exit = () => (state.dataset ? void host?.exit() : host?.selectBar());
  const native = (label: string) => host?.nativeControl(label);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,[contenteditable]")) return;
      if (e.key === "Escape") {
        setFly(null);
        setMenu(false);
        setCalendar(false);
        setTool("cursor");
        host?.tools(null);
        if (state.selecting) host?.selectBar();
      }
      const shortcuts: Record<string, string> = {
        KeyT: "trend",
        KeyH: "hline",
        KeyJ: "hray",
        KeyV: "vline",
        KeyC: "cross",
        KeyF: "fibr",
      };
      if (e.altKey && shortcuts[e.code]) {
        e.preventDefault();
        pick(shortcuts[e.code]!);
      }
    };
    el.addEventListener("keydown", key);
    return () => el.removeEventListener("keydown", key);
  });

  useEffect(() => {
    host?.scaleUi(12 / 26);
  }, [host, fit.scale]);
  // The existing trading panel and the Quant panels share the right-hand space.
  useEffect(() => {
    if (activePanel && state.tradeOpen) host?.toggleTrade();
    // A Quant-panel selection closes the trade panel once, without changing replay state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);
  useEffect(() => {
    if (state.tradeOpen) onPanel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tradeOpen]);
  const renderNode = (node: SourceNodeData) => {
    if ((omitted.has(node.key) && ![93, 94].includes(node.key)) || node.tag === "input")
      return null;
    const key = node.key,
      l = parseFloat(node.style.left),
      t = parseFloat(node.style.top);
    if (key === 1 || (key >= 81 && key <= 88) || (key >= 169 && key <= 175) || key >= 220)
      return null;
    if (l >= 1735 && l < 2330 && t >= 80 && !panel) return null;
    if (l >= 107 && l < 1740 && t >= 1268 && t < 1362 && !replay) return null;
    if (key >= 126 && key <= 140 && !menu) return null;
    let style =
        l < 100 && t >= 80
          ? (node.style as CSSProperties)
          : shiftedStyle(node.style as CSSProperties, panel, replay),
      children: ReactNode | undefined,
      markup: string | undefined;
    if (key === 35 && tool !== "cursor") style = { ...style, display: "none" };
    if (key === 35 && tool === "cursor") style = { ...style, background: "#e6f0ff" };
    // Pixel-perfect TradingView light theme icon paths directly from the prototype
    const tvIcons: Record<number, string> = {
      // 1. Cross (viewBox 0 0 28 28)
      36: '<path d="M14 5v6M14 17v6M5 14h6M17 14h6"/>',
      // 2. Trend Line (viewBox 0 0 28 28)
      37: '<path d="M9.2 18.8L18.8 9.2"/><circle cx="8" cy="20" r="2.2"/><circle cx="20" cy="8" r="2.2"/>',
      // 3. Fib and Gann (viewBox 0 0 28 28)
      38: '<path d="M11 8h11M6 14h16M6 20h11"/><circle cx="8.5" cy="8" r="2"/><circle cx="19.5" cy="20" r="2"/>',
      // 4. Patterns (viewBox 0 0 28 28)
      39: '<path d="M7.2 19.2L9.6 9.6M11.6 10.6l3 6.4M16.4 16.4l3.6-6.8M20.6 11.4l-6 9.6M7.8 20.2l5.4 1.2M10.4 8.5l8.4.8"/><circle cx="7" cy="20" r="1.8"/><circle cx="10" cy="8" r="1.8"/><circle cx="15" cy="18" r="1.8"/><circle cx="21" cy="9" r="1.8"/><circle cx="21" cy="21" r="1.8"/>',
      // 5. Projection (viewBox 0 0 28 28)
      40: '<path d="M6 8h16M13 14h9M6 20h16M9 12v8M9 12h4"/><circle cx="9" cy="20" r="1.6"/>',
      // 6. Brushes and shapes (viewBox 0 0 28 28)
      41: '<path d="M21.5 6.5l-8.8 8.8 2 2 8.8-8.8a1.4 1.4 0 0 0 0-2l0 0a1.4 1.4 0 0 0-2 0z"/><path d="M12.2 15.8c-2.4-.4-4 1-4.4 3-.2 1-.8 1.7-2.3 2 3.4 1.6 7.2.6 8.2-2.2.3-.8.2-1.9-.6-2.4"/>',
      // 7. Text and notes (viewBox 0 0 28 28)
      42: '<path d="M8 8.5h12M14 8.5v12M12 20.5h4"/>',
      // 8. Icons and emojis (viewBox 0 0 28 28)
      43: '<circle cx="14" cy="14" r="8.5"/><path d="M10.6 16.6c.9 1.4 2 2.1 3.4 2.1s2.5-.7 3.4-2.1"/><circle cx="11.3" cy="11.8" r=".9" fill="currentColor" stroke="none"/><circle cx="16.7" cy="11.8" r=".9" fill="currentColor" stroke="none"/>',
      // 9. Measure (viewBox 0 0 28 28)
      44: '<g transform="rotate(-45 14 14)"><rect x="2.5" y="10" width="23" height="8" rx="1.2"/><path d="M6.5 10v3M10.5 10v4.5M14.5 10v3M18.5 10v4.5M22.5 10v3"/></g>',
      // 10. Zoom in (viewBox 0 0 28 28)
      45: '<circle cx="12.5" cy="12.5" r="6.5"/><path d="M17.3 17.3L23 23M12.5 9.7v5.6M9.7 12.5h5.6"/>',
      // 11. Magnet mode (viewBox 0 0 28 28)
      46: '<path d="M7.5 6.5h4.5v10a2 2 0 0 0 4 0v-10h4.5v10a6.5 6.5 0 0 1-13 0z"/><path d="M7.5 11h4.5M16 11h4.5"/>',
      // 12. Stay in drawing mode (viewBox 0 0 28 28)
      47: '<path d="M16.6 6.4l3 3-9.5 9.5-4 1 1-4z"/><path d="M14.6 8.4l3 3"/><rect x="16.5" y="17" width="7" height="5.5" rx="1"/><path d="M18 17v-1.4a2 2 0 0 1 4 0V17"/>',
      // 13. Lock all drawings (viewBox 0 0 28 28)
      48: '<rect x="8" y="13" width="12" height="9" rx="1.6"/><path d="M10.5 13v-3a3.5 3.5 0 0 1 6.6-1.6"/><circle cx="14" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
      // 14. Hide all drawings (viewBox 0 0 28 28)
      49: '<path d="M4 14s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="14" cy="14" r="3"/>',
      // 15. Stay in drawing mode toggle icon (node 52)
      52: '<path d="M16.6 6.4l3 3-9.5 9.5-4 1 1-4z"/><path d="M14.6 8.4l3 3"/><rect x="16.5" y="17" width="7" height="5.5" rx="1"/><path d="M18 17v-1.4a2 2 0 0 1 4 0V17"/>',
      // 16. Remove objects / Trash (viewBox 0 0 28 28)
      50: '<path d="M7 9h14M12 9V7h4v2M9 9l1 12.5h8L19 9M12.5 12.5v6.5M15.5 12.5v6.5"/>',
    };
    if (tvIcons[key]) markup = tvIcons[key];

    // Show currently active tool icon for any of the 7 flyout groups
    const groupKeyMap: Record<number, GroupKey> = {
      37: "lines",
      38: "fib",
      39: "pattern",
      40: "proj",
      41: "brush",
      42: "text",
      43: "emoji",
    };
    if (groupKeyMap[key]) {
      const gKey = groupKeyMap[key]!;
      const flyoutGroup = FLYOUT_GROUPS[gKey];
      if (flyoutGroup && flyoutGroup.sections) {
        const found = flyoutGroup.sections
          .flatMap((s) => s.rows)
          .find((r) => r.id === groupTools[gKey]);
        if (found) markup = found.svg;
      }
    }

    /* "Stay in Drawing Mode" → TradingView light theme: transparent bg, dark icon */
    if (key === 51) style = { ...style, background: "transparent", borderRadius: 8 };
    if (key === 52) style = { ...style, stroke: "#131722" };
    if (key === 6) {
      markup = `<circle cx="24" cy="24" r="24" fill="#131722"/><path d="${BRAND.monogramPath}" fill="#fff" transform="translate(8 8)"/>`;
    }
    if (key === 8 || key === 177) children = ticker;
    if (key === 11 || key === 149) children = timeframe;
    if (key === 21) style = { ...style, background: replay ? "#131722" : "transparent" };
    if (key === 22) style = { ...style, stroke: replay ? "#fff" : "#131722" };
    if (key === 23) style = { ...style, color: replay ? "#fff" : "#131722" };
    if (key === 146) markup = playing ? '<path d="M8 5v14M16 5v14"/>' : toolIcons["play"];
    if (key === 148) children = `${speed}x`;
    if (key === 142) style = { ...style, stroke: state.selecting ? "#2962ff" : "#131722" };
    if (key === 143) style = { ...style, color: state.selecting ? "#2962ff" : "#131722" };
    if (key === 165)
      children = `${new Date(bar?.time ?? Date.now()).toISOString().slice(11, 19)} UTC`;
    if (key === 184) style = { ...style, background: sell ? "#fbc9ce" : "#f0f3fa" };
    if (key === 185) style = { ...style, background: sell ? "#f0f3fa" : "#bbd9fb" };
    if (key === 186 || key === 187) style = { ...style, color: sell ? "#f23645" : "#131722" };
    if (key === 188 || key === 189) style = { ...style, color: sell ? "#131722" : "#2962ff" };
    if (key === 187 || key === 189) children = mark ? priceText(mark) : "–";
    if (key === 196) style = { ...style, left: [1827, 1963, 2096, 2232][ot]! - 63 };
    if (key === 198) children = quote;
    if (key === 204)
      children = ot ? (
        <input
          aria-label="Order price"
          className="source-price-input"
          inputMode="decimal"
          value={orderPrice}
          onChange={(e) => setOrderPrice(e.target.value)}
        />
      ) : (
        priceText(mark)
      );
    if (key === 212) children = <span id="rr">{risk.ratio}</span>;
    if (key === 213) children = `Risk $${f2(risk.risk)} · Reward $${f2(risk.reward)}`;
    if (key === 216)
      children = (
        <>
          <b style={{ fontWeight: 600 }}>{tick}</b> <span style={{ fontSize: 21 }}>{quote}</span>
        </>
      );
    if (key === 218)
      children = (
        <>
          <b style={{ fontWeight: 600 }}>{f2(q * entry)}</b>{" "}
          <span style={{ fontSize: 21 }}>{quote}</span>
        </>
      );
    if (key === 219) {
      style = { ...style, background: sell ? "#f23645" : "#2962ff" };
      children = flash ? (
        <div style={{ fontSize: 30 }}>{flash}</div>
      ) : (
        <>
          <div style={{ fontSize: 30 }}>{sell ? "Sell" : "Buy"}</div>
          <div style={{ fontWeight: 400, fontSize: 25 }}>
            {quantity} {ticker} {suffix[ot]}
          </div>
        </>
      );
    }
    if (key === 128) children = `Buy ${quantity} ${ticker} @ ${priceText(menuPrice ?? mark)} limit`;
    if (key === 131) children = `Sell ${quantity} ${ticker} @ ${priceText(menuPrice ?? mark)} stop`;
    if (key === 133)
      children = `Sell ${quantity} ${ticker} @ ${priceText(menuPrice ?? mark)} stop ${priceText((menuPrice ?? mark) + tick)} limit`;
    if (key === 135) children = `Add order on ${ticker} at ${priceText(menuPrice ?? mark)}...`;
    if (key === 138) children = `Draw Horizontal Line at ${priceText(menuPrice ?? mark)}`;
    const content = (
      <SourceNode
        key={key}
        node={node}
        style={t < 80 ? toolbarPlace(style) : place(style)}
        {...(children !== undefined ? { children } : {})}
        {...(markup !== undefined ? { markup } : {})}
      />
    );
    return t < 80 ? (
      <div
        key={key}
        className="source-toolbar-layer"
        style={{ top: (80 * (1 - toolbarRatio)) / 2, transform: `scale(${toolbarRatio})` }}
      >
        {content}
      </div>
    ) : (
      content
    );
  };
  const hit = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fn: () => void,
    disabled = false,
    pressed?: boolean,
  ) => {
    const original =
      x < 100 && y >= 80
        ? { left: x, top: y, width: w, height: h }
        : shiftedStyle({ left: x, top: y, width: w, height: h }, panel, replay);
    const style = y < 80 ? toolbarPlace(original) : place(original);
    if ("visibility" in style && style.visibility === "hidden") return null;
    const content = (
      <HitTarget
        x={Number(style.left)}
        y={Number(style.top)}
        width={w}
        height={h}
        label={label}
        onClick={fn}
        disabled={disabled}
        {...(pressed !== undefined ? { pressed } : {})}
      />
    );
    return y < 80 ? (
      <div
        className="source-toolbar-layer"
        style={{ top: (80 * (1 - toolbarRatio)) / 2, transform: `scale(${toolbarRatio})` }}
      >
        {content}
      </div>
    ) : (
      content
    );
  };
  const costs = `Paper execution only. ${COSTS.spreadBps} bps synthetic spread, ${COSTS.slippageBps} bp slippage, ${COSTS.commissionBps} bp commission per fill. Orders eligible next observed candle. Stop-first OHLC ambiguity, no entry-bar TP. Stop-limit limit leg starts after trigger candle closes. Quote-unit P&L; no currency conversion or leverage. Missing intervals are not fabricated. Rewinding discards future actions.`;
  return (
    <div
      ref={root}
      className="html-workspace replay-workspace"
      role="region"
      aria-label="Deplyze Quant chart workspace"
      onWheel={(event) => {
        if (event.clientX - (root.current?.getBoundingClientRect().left ?? 0) < 107 * fit.scale) {
          setDrawingScroll((value) =>
            Math.max(0, Math.min(maxDrawingScroll, value + event.deltaY / fit.scale)),
          );
        }
      }}
      onClick={() => {
        setMenu(false);
        setCalendar(false);
        setFly(null);
      }}
    >
      <div
        className="html-stage"
        style={{
          left: 0,
          top: 0,
          height: 1512 + fit.extraHeight,
          width: 2419 + fit.extraWidth,
          transform: `scale(${fit.scale})`,
        }}
        tabIndex={-1}
      >
        {source.nodes.slice(0, 6).map(renderNode)}
        <div
          className="source-chart"
          style={
            {
              left: 107,
              top: HEADER,
              width: (1625 + (panel ? 0 : 593) + fit.extraWidth - dockWidth) * fit.scale,
              height: (1192 + (replay ? 0 : 94) + fit.extraHeight) * fit.scale,
              transform: `scale(${1 / fit.scale})`,
              transformOrigin: "0 0",
              "--source-legend-offset": "36px",
            } as CSSProperties
          }
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuPrice(state.crosshairPrice ?? mark);
            setMenu(true);
          }}
        >
          <div ref={chartRef} className="html-native" inert={busy} aria-busy={busy} />
        </div>
        {(Object.keys(GROUPS) as GroupKey[])
          .filter((key) => GROUPS[key].secs.some(([, rows]) => rows.some((r) => r[0] === tool)))
          .map((key) => (
            <div
              className="a tv-tool-active"
              key={key}
              style={place({
                left: 14,
                top: GROUPS[key].y - 32,
                width: 68,
                height: 68,
                background: "#e6f0ff",
                borderRadius: 8,
              })}
            />
          ))}
        {source.nodes.slice(6).map(renderNode)}
        <div
          className="chart-widget-bar"
          style={{
            ...place({ left: 107, top: HEADER }),
            width: 1625 + (panel ? 0 : 593) + fit.extraWidth - dockWidth,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="chart-legend">
            <svg className="chart-legend-icon" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="18" fill="#131722" />
              <path d={BRAND.monogramPath} fill="#fff" transform="translate(5 3) scale(.85)" />
            </svg>
            <div className="chart-legend-title">
              {`${ticker} · ${timeframe} · ${(state.dataset?.symbol ?? state.market?.symbol ?? "").split(":")[0]?.toUpperCase() ?? ""}`}
            </div>
          </div>
          <button
            type="button"
            className="chart-quote-btn sell"
            aria-label="Sell quote"
            onClick={() => openPanel("sell")}
          >
            <span className="chart-quote-px">{mark ? priceText(mark) : "–"}</span>
            <span className="chart-quote-side">SELL</span>
          </button>
          <div className="chart-quote-qty">{quantity}</div>
          <button
            type="button"
            className="chart-quote-btn buy"
            aria-label="Buy quote"
            onClick={() => openPanel("buy")}
          >
            <span className="chart-quote-px">{mark ? priceText(mark) : "–"}</span>
            <span className="chart-quote-side">BUY</span>
          </button>
        </div>
        {panel &&
          source.nodes
            .filter((n) => n.tag === "input")
            .map((node) => {
              const id = node.attrs.id!;
              return (
                <input
                  key={id}
                  id={id}
                  data-source-node={node.key}
                  aria-label={
                    {
                      qty: "Order quantity",
                      tp: "Take profit",
                      sl: "Stop loss",
                      rk: "Risk amount",
                    }[id]
                  }
                  style={
                    {
                      ...place(node.style as CSSProperties),
                      ...((id === "sl" && stopInvalid) || (id === "tp" && targetInvalid)
                        ? { borderColor: "#f23645" }
                        : id === "sl" || id === "tp"
                          ? { borderColor: "#767676" }
                          : {}),
                      ...(id === "qty" ? { padding: "1px 2px" } : {}),
                    } as CSSProperties
                  }
                  inputMode={id === "qty" ? "numeric" : "decimal"}
                  value={{ qty: quantity, tp, sl, rk: riskInput }[id] ?? ""}
                  placeholder={node.attrs.placeholder}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (id === "qty") setQuantity(value);
                    else if (id === "tp" || id === "sl") changeProtection(id, value);
                    else {
                      setRiskInput(value);
                      const risk = Number(value),
                        stop = Number(sl);
                      if (stop && risk > 0 && Math.abs(entry - stop) > 0)
                        setQuantity(String(Math.max(1, Math.floor(risk / Math.abs(entry - stop)))));
                    }
                  }}
                />
              );
            })}
        {hit(
          1002,
          5,
          162,
          63,
          "Replay",
          () => {
            if (state.dataset) void host?.exit();
            else {
              host?.selectBar();
              host?.speed(10);
            }
          },
          busy || !state.ready,
          replay,
        )}
        {hit(105, 8, 230, 58, "Search markets", () => host?.search(), !!state.dataset)}
        {hit(384, 8, 54, 58, "Chart timeframe", () => native("Timeframe"), !!state.dataset)}
        {hit(474, 8, 54, 58, "Chart style", () => native("Chart style"))}
        {hit(563, 8, 203, 58, "Indicators", () => native("Indicators"))}
        {hit(1195, 8, 50, 58, "Undo", () => host?.undo(), busy)}
        {hit(1266, 8, 50, 58, "Redo", () => host?.redo(), busy)}
        {hit(2060, 8, 54, 58, "Chart settings", () => host?.settings())}
        {hit(2135, 8, 50, 58, "Fullscreen", () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void root.current?.requestFullscreen();
        })}
        {hit(2206, 8, 50, 58, "Chart screenshot", () => host?.screenshot())}
        {hit(1580, 318, 38, 38, "Order context menu", () => {
          setMenuPrice(state.crosshairPrice ?? mark);
          setMenu(!menu);
        })}
        {hit(18, 92, 68, 68, "Cursor", () => {
          setTool("cursor");
          host?.tools(null);
          setFly(null);
        })}
        {hit(18, 694, 68, 68, "Measure", () => host?.mode("measure"))}
        {hit(18, 762, 68, 68, "Zoom in", () => host?.tools("magnifier"))}
        {hit(18, 861, 68, 68, "Magnet", () => host?.snap())}
        {hit(18, 1246, 68, 68, "Delete drawings", () => host?.clearDrawings())}
        {replay && (
          <>
            {hit(
              600,
              1290,
              240,
              52,
              "Select bar",
              () => host?.selectBar(),
              busy,
              !!state.selecting,
            )}
            {hit(
              870,
              1290,
              64,
              52,
              playing ? "Pause replay" : "Play replay",
              () => (playing ? host?.pause() : host?.play()),
              !state.dataset || state.view?.status === "ended",
            )}
            {hit(
              945,
              1290,
              64,
              52,
              "Next candle",
              () => void host?.next(),
              busy || !state.dataset || state.view?.status === "ended",
            )}
            {hit(
              1015,
              1290,
              66,
              52,
              "Replay playback speed",
              () => {
                const speeds = [1, 3, 10, 30];
                host?.speed(speeds[(speeds.indexOf(speed) + 1) % speeds.length]!);
              },
              !state.dataset,
            )}
            {hit(
              1195,
              1290,
              56,
              52,
              "Final replay candle",
              () => {
                if (state.dataset) void host?.seek(state.dataset.bars.length - 1);
              },
              busy || !state.dataset,
            )}
            {hit(1640, 1290, 52, 52, "Exit Replay", exit, busy)}
          </>
        )}
        {hit(692, 1374, 46, 46, "Go to date", () => setCalendar(!calendar), busy)}
        {(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"] as const).map((range, i) => (
          <Fragment key={range}>
            {hit(
              [150, 208, 269, 330, 391, 460, 532, 582, 637][i]! - 22,
              1376,
              44,
              44,
              `${range} range`,
              () => {
                if (range === "All") host?.range("ALL");
                else if (range === "5D") host?.rangeDays(5);
                else if (range === "5Y") host?.rangeDays(365.25 * 5);
                else host?.range(range);
              },
            )}
          </Fragment>
        ))}
        {panel && (
          <>
            {hit(2240, 100, 50, 50, "Close trading panel", () => host?.toggleTrade())}
            {hit(1764, 265, 266, 97, "Sell side", () => openPanel("sell"))}
            {hit(2030, 265, 267, 97, "Buy side", () => openPanel("buy"))}
            {[1827, 1963, 2096, 2232].map((cx, i) => (
              <Fragment key={i}>
                {hit(
                  cx - 65,
                  395,
                  130,
                  50,
                  `Order type ${types[i]}`,
                  () => setOt(i),
                  false,
                  ot === i,
                )}
              </Fragment>
            ))}
            {hit(
              1764,
              1060,
              532,
              104,
              `${sell ? "Sell" : "Buy"} paper order`,
              () => void submit(),
              busy || playing || !state.ready || !mark || state.view?.status === "ended",
            )}
            <div
              className="a source-execution-note"
              style={{ left: 1764, top: 910, width: 532, height: 40 }}
              title={costs}
              aria-label={costs}
            />
          </>
        )}
        {menu && (
          <>
            {[
              [399, "buy", 1],
              [460, "sell", 2],
              [520, "sell", 3],
              [581, "buy", ot],
            ].map(([y, s, o]) => (
              <Fragment key={y}>
                {hit(1022, Number(y) - 29, 589, 58, `Context order ${y}`, () => {
                  setMenu(false);
                  openPanel(s as "buy" | "sell", Number(o), menuPrice ?? mark);
                })}
              </Fragment>
            ))}
            {hit(1022, 637, 589, 58, "Draw Horizontal Line", () => {
              setMenu(false);
              host?.drawHorizontal(menuPrice ?? mark);
            })}
          </>
        )}
        <DrawingFlyout
          open={fly}
          setOpen={setFly}
          tool={tool}
          onPick={pick}
          favorites={favorites}
          current={groupTools}
          toggleFavorite={(id) =>
            setFavorites((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        {calendar && (
          <ReplayCalendar
            initial={bar?.time ?? Date.now()}
            available={
              state.dataset
                ? {
                    first: state.dataset.bars[state.dataset.warmup]!.time + state.dataset.interval,
                    last: state.dataset.coverage.lastClose,
                  }
                : undefined
            }
            onSelect={(time) => void selectDate(time)}
          />
        )}
        {(flash || state.error || state.view?.error || busy) && (
          <div
            className="source-toast"
            role={state.error || state.view?.error ? "alert" : "status"}
          >
            {state.error || state.view?.error || flash || "Preparing closed-candle state…"}
          </div>
        )}
        {state.selecting && state.selectionTime != null && (
          <div className="source-selection-time">
            {new Date(state.selectionTime).toISOString().slice(0, 16).replace("T", " ")} UTC
          </div>
        )}
        {state.saved &&
          !state.dataset &&
          hit(1735, 8, 220, 58, "Restore session", () => void host?.restore(), busy)}
        <a
          style={{ top: (replay ? 1211 : 1305) + fit.extraHeight }}
          className="source-attribution"
          href="https://velacharts.dev"
          target="_blank"
          rel="noreferrer"
        >
          Charts by Vela
        </a>
      </div>
      <RightSidebar
        activePanel={activePanel}
        trading={panel}
        onPanel={onPanel}
        onTrade={() => (panel ? host?.toggleTrade() : openPanel())}
      />
      {panel && (
        <div
          className="paper-position-footer"
          style={{ right: 84 * fit.scale, width: 593 * fit.scale }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="paper-position-status"
            title={`${costs} ${state.dataset && state.view ? `${state.view.cursor - state.dataset.warmup + 1}/${state.dataset.bars.length - state.dataset.warmup} ${state.view.status}` : "Live"}`}
            role="status"
          >
            {p ? (
              <>
                <b>{p.side === "buy" ? "Long" : "Short"}</b> {p.quantity} {ticker} @{" "}
                {priceText(p.entry)} &nbsp;P&amp;L{" "}
                <b style={{ color: (state.trading?.unrealized ?? 0) >= 0 ? "#089981" : "#f23645" }}>
                  {signed(state.trading?.unrealized ?? 0)}
                </b>
              </>
            ) : state.trading?.pending ? (
              `Pending ${typeof state.trading.pending === "string" ? "close" : state.trading.pending.type}`
            ) : (
              "No open position"
            )}{" "}
            &nbsp;·&nbsp; Realized <b>{signed(state.trading?.realized ?? 0)}</b>
          </div>
          {(p || state.trading?.pending) && (
            <button
              className="paper-position-close"
              disabled={busy || playing || !state.ready || !mark || state.view?.status === "ended"}
              onClick={() => host?.trade(state.trading?.pending ? "cancel" : "close")}
            >
              {state.trading?.pending ? "Cancel" : "Close"}
            </button>
          )}
        </div>
      )}
      <div
        className="quant-right-dock"
        style={{ right: 84 * fit.scale, width: dockPixels }}
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
