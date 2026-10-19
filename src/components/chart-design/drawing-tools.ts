import source from "./source.json";
import type { DrawingTypeKey } from "@luxalgo/vela";
export type GroupKey = keyof typeof source.groups;
export type ToolRow = [string, string, string, string?, number?];
export const GROUPS = source.groups as unknown as Record<
  GroupKey,
  { y: number; cur: string; secs: [string | null, ToolRow[]][] }
>;

export const TOOL_MAP: Record<string, DrawingTypeKey> = {
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
};
