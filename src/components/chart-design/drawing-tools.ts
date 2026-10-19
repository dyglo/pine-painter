import type { DrawingTypeKey } from "@luxalgo/vela";
import { FLYOUT_GROUPS } from "./flyout-data";

export type GroupKey = "lines" | "fib" | "pattern" | "proj" | "brush" | "text" | "emoji";

export type ToolRow = [string, string, string, string?, number?];

export interface GroupConfig {
  y: number;
  cur: string;
  secs: [string | null, ToolRow[]][];
}

// Convert FLYOUT_GROUPS into compatible GROUPS structure
export const GROUPS: Record<GroupKey, GroupConfig> = {
  lines: {
    y: FLYOUT_GROUPS.lines!.y,
    cur: FLYOUT_GROUPS.lines!.defaultTool,
    secs: (FLYOUT_GROUPS.lines!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", r.hasHelp ? 1 : 0] as ToolRow),
    ]),
  },
  fib: {
    y: FLYOUT_GROUPS.fib!.y,
    cur: FLYOUT_GROUPS.fib!.defaultTool,
    secs: (FLYOUT_GROUPS.fib!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", r.hasHelp ? 1 : 0] as ToolRow),
    ]),
  },
  pattern: {
    y: FLYOUT_GROUPS.pattern!.y,
    cur: FLYOUT_GROUPS.pattern!.defaultTool,
    secs: (FLYOUT_GROUPS.pattern!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", 0] as ToolRow),
    ]),
  },
  proj: {
    y: FLYOUT_GROUPS.proj!.y,
    cur: FLYOUT_GROUPS.proj!.defaultTool,
    secs: (FLYOUT_GROUPS.proj!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", 0] as ToolRow),
    ]),
  },
  brush: {
    y: FLYOUT_GROUPS.brush!.y,
    cur: FLYOUT_GROUPS.brush!.defaultTool,
    secs: (FLYOUT_GROUPS.brush!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", 0] as ToolRow),
    ]),
  },
  text: {
    y: FLYOUT_GROUPS.text!.y,
    cur: FLYOUT_GROUPS.text!.defaultTool,
    secs: (FLYOUT_GROUPS.text!.sections || []).map((sec) => [
      sec.header,
      sec.rows.map((r) => [r.id, r.label, r.id, r.shortcut || "", 0] as ToolRow),
    ]),
  },
  emoji: {
    y: FLYOUT_GROUPS.emoji!.y,
    cur: FLYOUT_GROUPS.emoji!.defaultTool,
    secs: [
      [
        "Smileys",
        Array.from({ length: 40 }, (_, i) => [
          `emoji-${i}`,
          `Emoji ${i + 1}`,
          `emoji-${i}`,
          "",
          0,
        ] as ToolRow),
      ],
    ],
  },
};

export const TOOL_MAP: Record<string, DrawingTypeKey> = {
  // Legacy short IDs
  trend: "trendline",
  arrow: "arrow",
  ray: "ray",
  info: "infoline",
  extl: "extendedline",
  angle: "trendangle",
  hline: "hline",
  hray: "hray",
  vline: "vline",
  cross: "crossline",
  chan: "parallelchannel",
  fibr: "fibretracement",
  fibext: "fibextensiontrend",
  pitch: "pitchfork",
  schiff: "schiffpitchfork",
  mschiff: "modifiedschiffpitchfork",
  inpitch: "insidepitchfork",
  fibch: "fibchannel",
  fibtz: "fibtimezones",
  long: "position",
  short: "position",
  avwap: "anchoredvwap",
  frvp: "fixedrangevp",
  prange: "datepricerange",
  drange: "datepricerange",
  dprange: "datepricerange",

  // Lines group
  trendline: "trendline",
  "info-line": "infoline",
  "extended-line": "extendedline",
  "trend-angle": "trendangle",
  "horizontal-line": "hline",
  "horizontal-ray": "hray",
  "vertical-line": "vline",
  crossline: "crossline",
  "parallel-channel": "parallelchannel",
  "regression-trend": "regressionchannel",
  "flat-top-bottom": "flattopbottom",
  "disjoint-channel": "disjointchannel",
  pitchfork: "pitchfork",
  "schiff-pitchfork": "schiffpitchfork",
  "modified-schiff-pitchfork": "modifiedschiffpitchfork",
  "inside-pitchfork": "insidepitchfork",

  // Fib & Gann group
  "fib-retracement": "fibretracement",
  "trend-based-fib-extension": "fibextensiontrend",
  "fib-channel": "fibchannel",
  "fib-time-zone": "fibtimezones",
  "fib-speed-resistance-fan": "fibspeedfan",
  "trend-based-fib-time": "trendfibtime",
  "fib-circles": "fibcircles",
  "fib-spiral": "fibspiral",
  "fib-speed-resistance-arcs": "fibarcs",
  "fib-wedge": "fibwedge",
  pitchfan: "fibfan",
  "gann-box": "gannbox",
  "gann-square-fixed": "gannsquare",
  "gann-square": "gannsquare",
  "gann-fan": "gannfan",

  // Patterns group
  "xabcd-pattern": "xabcd",
  "cypher-pattern": "cypher",
  "head-and-shoulders": "headshoulders",
  "abcd-pattern": "abcd",
  "triangle-pattern": "triangle",
  "three-drives-pattern": "xabcd",
  "elliott-impulse-wave-12345": "elliottimpulse",
  "elliott-correction-wave-abc": "elliottcorrection",
  "elliott-triangle-wave-abcde": "elliottimpulse",
  "elliott-double-combo-wave-wxy": "elliottcorrection",
  "elliott-triple-combo-wave-wxyxz": "elliottcorrection",
  "cyclic-lines": "fibtimezones",
  "time-cycles": "fibtimezones",
  "sine-line": "curve",

  // Forecasting and measurement group
  "long-position": "position",
  "short-position": "position",
  "position-forecast": "position",
  "bars-pattern": "position",
  "ghost-feed": "position",
  sector: "arc",
  "anchored-vwap": "anchoredvwap",
  "fixed-range-volume-profile": "fixedrangevp",
  "anchored-volume-profile": "fixedrangevp",
  "price-range": "datepricerange",
  "date-range": "datepricerange",
  "date-and-price-range": "datepricerange",

  // Brushes, arrows and shapes group
  brush: "freehand",
  highlighter: "highlighter",
  "arrow-marker": "arrow",
  "arrow-mark-up": "arrowmarkup",
  "arrow-mark-down": "arrowmarkdown",
  rectangle: "box",
  "rotated-rectangle": "rotatedrect",
  path: "path",
  circle: "circle",
  ellipse: "ellipse",
  polyline: "polyline",
  triangle: "triangle",
  arc: "arc",
  curve: "curve",
  "double-curve": "curve",

  // Text and notes group
  text: "text",
  "anchored-text": "text",
  note: "note",
  "price-note": "pricenote",
  pin: "signpost",
  table: "box",
  callout: "callout",
  comment: "comment",
  "price-label": "pricelabel",
  signpost: "signpost",
  "flag-mark": "flagmark",
  image: "iconstamp",
  post: "note",
  idea: "note",

  // Icons and emojis
  stamp: "iconstamp",
};
