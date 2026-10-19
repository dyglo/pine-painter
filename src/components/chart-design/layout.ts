import type { CSSProperties } from "react";
import source from "./source.json";
export const DESIGN = { width: 2419, height: 1512, panelWidth: 593 } as const;
export type SourceNodeData = (typeof source.nodes)[number];
/** Original sxOf/syOf/shift rules, without DOM mutation or synthetic chart state. */
export function shiftedStyle(style: CSSProperties, panel: boolean, replay: boolean): CSSProperties {
  const l = parseFloat(String(style.left)),
    t = parseFloat(String(style.top)),
    w = parseFloat(String(style.width)) || 0;
  let sx = 0;
  if (
    (t >= 80 && t < 1320 && l >= 1580 && l < 1735) ||
    (l === 1328 && t === 1214) ||
    (t === 1241 && l < 1700) ||
    (t === 80 && w === 2) ||
    (t === 1172 && [270, 868].includes(l)) ||
    (l >= 1015 && l < 1620 && t >= 365 && t <= 700) ||
    (t >= 1376 && t <= 1420 && l >= 1370) ||
    (t >= 1454 && l >= 1600)
  )
    sx = 1;
  else if (t >= 1268 && t < 1362) {
    if (l >= 1640) sx = 1;
    else if (l >= 600 && l < 1300) sx = 0.5;
  }
  const sy =
    (t === 1241 && l < 1700) ||
    (l === 1328 && t === 1214) ||
    (t === 1172 && [270, 868].includes(l)) ||
    (l === 127 && t === 1157);
  return {
    ...style,
    ...(Number.isFinite(l) ? { left: l + (panel ? 0 : DESIGN.panelWidth * sx) } : {}),
    ...(Number.isFinite(t) ? { top: t + (!replay && sy ? 94 : 0) } : {}),
    ...([1625, 1513, 1470, 1510].includes(w) ? { width: w + (panel ? 0 : DESIGN.panelWidth) } : {}),
  };
}
export function fitStage(width: number, height: number) {
  const scale = Math.min(width / DESIGN.width, height / DESIGN.height);
  return {
    scale,
    left: (width - DESIGN.width * scale) / 2,
    top: (height - DESIGN.height * scale) / 2,
  };
}
export function orderRisk(entry: number, stop: number, target: number, quantity: number) {
  const risk = stop ? Math.abs(entry - stop) * quantity : 0,
    reward = target ? Math.abs(target - entry) * quantity : 0;
  return { risk, reward, ratio: risk > 0 && reward > 0 ? (reward / risk).toFixed(2) : "–" };
}
