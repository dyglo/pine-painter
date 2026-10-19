// Pixel-perfect TradingView drawing tool flyouts data generated from prototype HTMLs
export type FlyoutGroupKey = "lines" | "fib" | "pattern" | "proj" | "brush" | "text" | "emoji";

export interface FlyoutRow {
  id: string;
  label: string;
  shortcut?: string;
  svg: string;
  hasStar?: boolean;
  hasHelp?: boolean;
}

export interface FlyoutSection {
  header: string;
  rows: FlyoutRow[];
}

export interface FlyoutGroup {
  key: FlyoutGroupKey;
  title: string;
  width: number; // in viewport px (stage width = width * 2)
  y: number; // in stage coordinates
  defaultTool: string;
  sections?: FlyoutSection[];
  isEmoji?: boolean;
}

export const FLYOUT_GROUPS: Record<FlyoutGroupKey, FlyoutGroup> = {
  "lines": {
    "key": "lines",
    "title": "Lines",
    "width": 283,
    "y": 199,
    "defaultTool": "trendline",
    "sections": [
      {
        "header": "Lines",
        "rows": [
          {
            "id": "trendline",
            "label": "Trendline",
            "shortcut": "Alt + T",
            "svg": "<path d=\"M9.4 18.6L18.6 9.4\"></path><circle cx=\"8\" cy=\"20\" r=\"2\"></circle><circle cx=\"20\" cy=\"8\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "ray-span-class-hp",
            "label": "Ray<span class=\"hp\">?",
            "shortcut": "",
            "svg": "<path d=\"M9.4 18.6l4.2-4.2M16.4 11.6L24 4\"></path><circle cx=\"8\" cy=\"20\" r=\"2\"></circle><circle cx=\"15\" cy=\"13\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": true
          },
          {
            "id": "info-line",
            "label": "Info line",
            "shortcut": "",
            "svg": "<path d=\"M9.4 18.6L18.6 9.4\"></path><rect x=\"4.5\" y=\"4.5\" width=\"9\" height=\"5\" rx=\"1\"></rect><circle cx=\"8\" cy=\"20\" r=\"2\"></circle><circle cx=\"20\" cy=\"8\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "extended-line",
            "label": "Extended line",
            "shortcut": "",
            "svg": "<path d=\"M4 24l5.6-5.6M12.4 15.6l3.2-3.2M18.4 9.6L24 4\"></path><circle cx=\"11\" cy=\"17\" r=\"2\"></circle><circle cx=\"17\" cy=\"11\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "trend-angle",
            "label": "Trend angle",
            "shortcut": "",
            "svg": "<path d=\"M8 21h13M8 21L19 9.6M14 21a6 6 0 0 0-1.8-4.2\"></path><circle cx=\"8\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"20\" cy=\"8.5\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "horizontal-line",
            "label": "Horizontal line",
            "shortcut": "Alt + H",
            "svg": "<path d=\"M4 14h8M16 14h8\"></path><circle cx=\"14\" cy=\"14\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "horizontal-ray",
            "label": "Horizontal ray",
            "shortcut": "Alt + J",
            "svg": "<circle cx=\"6\" cy=\"14\" r=\"2\"></circle><path d=\"M8 14h16\"></path>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "vertical-line",
            "label": "Vertical line",
            "shortcut": "Alt + V",
            "svg": "<path d=\"M14 4v8M14 16v8\"></path><circle cx=\"14\" cy=\"14\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "crossline",
            "label": "Crossline",
            "shortcut": "Alt + C",
            "svg": "<path d=\"M14 4v8M14 16v8M4 14h8M16 14h8\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Channels",
        "rows": [
          {
            "id": "parallel-channel",
            "label": "Parallel channel",
            "shortcut": "",
            "svg": "<path d=\"M9.4 18.6L18.6 9.4M10 24l12-12\"></path><circle cx=\"8\" cy=\"20\" r=\"2\"></circle><circle cx=\"20\" cy=\"8\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "regression-trend",
            "label": "Regression trend",
            "shortcut": "",
            "svg": "<path d=\"M5 11l17-6v11L5 22z\"></path><path d=\"M5 16.5l17-5.5\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "flat-top-bottom",
            "label": "Flat top/bottom",
            "shortcut": "",
            "svg": "<path d=\"M10 8h8M9.2 20.4L18.8 9.6\"></path><circle cx=\"8\" cy=\"8\" r=\"2\"></circle><circle cx=\"20\" cy=\"8\" r=\"2\"></circle><circle cx=\"8\" cy=\"22\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "disjoint-channel",
            "label": "Disjoint channel",
            "shortcut": "",
            "svg": "<path d=\"M10 8l8-1.6M10 22l8-1.6M8 10v10\"></path><circle cx=\"8\" cy=\"8\" r=\"2\"></circle><circle cx=\"20\" cy=\"6\" r=\"2\"></circle><circle cx=\"8\" cy=\"22\" r=\"2\"></circle><circle cx=\"20\" cy=\"20\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Pitchforks",
        "rows": [
          {
            "id": "pitchfork",
            "label": "Pitchfork",
            "shortcut": "",
            "svg": "<path d=\"M5 23L20 8M9 23l13-13M5 19L18 6\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "schiff-pitchfork",
            "label": "Schiff pitchfork",
            "shortcut": "",
            "svg": "<path d=\"M5 23L22 6M10 23l12-12M5 18L17 6M8 14l6 6\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "modified-schiff-pitchfork",
            "label": "Modified Schiff pitchfork",
            "shortcut": "",
            "svg": "<path d=\"M5 23L22 6M12 23l10-10M5 16L15 6M8 12l8 8\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "inside-pitchfork",
            "label": "Inside pitchfork",
            "shortcut": "",
            "svg": "<path d=\"M5 23L22 6M10 23l12-12M5 18L17 6M13 19l6-6\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "fib": {
    "key": "fib",
    "title": "Fib and Gann",
    "width": 288,
    "y": 270,
    "defaultTool": "fib-retracement",
    "sections": [
      {
        "header": "Fibonacci",
        "rows": [
          {
            "id": "fib-retracement",
            "label": "Fib retracement",
            "shortcut": "Alt + F",
            "svg": "<path d=\"M11 8h11M6 14h16M6 20h11\"></path><circle cx=\"8.5\" cy=\"8\" r=\"2\"></circle><circle cx=\"19.5\" cy=\"20\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "trend-based-fib-extension",
            "label": "Trend-based fib extension",
            "shortcut": "",
            "svg": "<path d=\"M8.6 18.6l1.8-5.2M12.4 11.4l3.1 4.5M17.3 15.4l1.6-5M11 7h12M11 20h12\"></path><circle cx=\"7.5\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"11.5\" cy=\"9.5\" r=\"1.8\"></circle><circle cx=\"16.5\" cy=\"17\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-channel-span-class-hp",
            "label": "Fib channel<span class=\"hp\">?",
            "shortcut": "",
            "svg": "<path d=\"M8 22L22 16M6 15l16-6M8 9l14-5\"></path><circle cx=\"6\" cy=\"22\" r=\"1.8\"></circle><circle cx=\"22\" cy=\"5\" r=\"1.8\"></circle>",
            "hasStar": true,
            "hasHelp": true
          },
          {
            "id": "fib-time-zone",
            "label": "Fib time zone",
            "shortcut": "",
            "svg": "<path d=\"M7 5v18M11 8v12M17 5v18M22 8v12M7 14h4M17 14h5\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-speed-resistance-fan",
            "label": "Fib speed resistance fan",
            "shortcut": "",
            "svg": "<path d=\"M5 23L23 5M5 23L23 11M5 23L23 17M5 23L17 5\"></path><circle cx=\"5\" cy=\"23\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "trend-based-fib-time",
            "label": "Trend-based fib time",
            "shortcut": "",
            "svg": "<path d=\"M6 22l5-9M14 5v18M19 5v18M24 5v18\"></path><circle cx=\"6\" cy=\"22\" r=\"1.8\"></circle><circle cx=\"11\" cy=\"13\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-circles",
            "label": "Fib circles",
            "shortcut": "",
            "svg": "<circle cx=\"14\" cy=\"14\" r=\"2.5\"></circle><circle cx=\"14\" cy=\"14\" r=\"6\"></circle><circle cx=\"14\" cy=\"14\" r=\"10\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-spiral",
            "label": "Fib spiral",
            "shortcut": "",
            "svg": "<path d=\"M14 14a2 2 0 0 1 2-2 4 4 0 0 1 4 4 7 7 0 0 1-7 7 11 11 0 0 1-11-11 17 17 0 0 1 17-17\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-speed-resistance-arcs",
            "label": "Fib speed resistance arcs",
            "shortcut": "",
            "svg": "<path d=\"M5 23L23 5M10 8a12 12 0 0 1 10 10M7 12a16 16 0 0 1 9 9M13 5a8 8 0 0 1 10 10\"></path><circle cx=\"5\" cy=\"23\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fib-wedge",
            "label": "Fib wedge",
            "shortcut": "",
            "svg": "<path d=\"M6 22L22 8M6 22L22 16M6 22L22 22M10 14a10 10 0 0 1 10 8M13 12a14 14 0 0 1 8 10\"></path><circle cx=\"6\" cy=\"22\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "pitchfan",
            "label": "Pitchfan",
            "shortcut": "",
            "svg": "<path d=\"M6 14L22 4M6 14L22 11M6 14L22 18M6 14L22 24\"></path><circle cx=\"6\" cy=\"14\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Gann",
        "rows": [
          {
            "id": "gann-box",
            "label": "Gann box",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"5\" width=\"18\" height=\"18\"></rect><path d=\"M5 5l18 18M5 23L23 5M5 14h18M14 5v18\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "gann-square-fixed",
            "label": "Gann square fixed",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"5\" width=\"18\" height=\"18\"></rect><path d=\"M5 5l18 18M5 23L23 5M5 11h18M5 17h18M11 5v18M17 5v18\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "gann-square",
            "label": "Gann square",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"5\" width=\"18\" height=\"18\"></rect><path d=\"M5 5l18 18M5 14h18M14 5v18M5 23L23 5\"></path><circle cx=\"5\" cy=\"5\" r=\"1.8\"></circle><circle cx=\"23\" cy=\"23\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "gann-fan",
            "label": "Gann fan",
            "shortcut": "",
            "svg": "<path d=\"M5 23L23 5M5 23L23 9M5 23L23 14M5 23L23 19M5 23L9 5M5 23L14 5\"></path><circle cx=\"5\" cy=\"23\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "pattern": {
    "key": "pattern",
    "title": "Patterns",
    "width": 283,
    "y": 341,
    "defaultTool": "xabcd-pattern",
    "sections": [
      {
        "header": "Chart patterns",
        "rows": [
          {
            "id": "xabcd-pattern",
            "label": "XABCD pattern",
            "shortcut": "",
            "svg": "<path d=\"M7.4 19.6l2.4-9.2M11.6 9.6l4.6 7.2M17.8 16.2l2.2-6.6M7.8 20.4l7.6-3M10.8 8.6l8.6.8\"></path><circle cx=\"7\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"10.5\" cy=\"8.5\" r=\"1.8\"></circle><circle cx=\"16.5\" cy=\"18\" r=\"1.8\"></circle><circle cx=\"21\" cy=\"9\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "cypher-pattern",
            "label": "Cypher pattern",
            "shortcut": "",
            "svg": "<path d=\"M7.4 19.6l2.4-9.2M11.6 9.6l4.6 7.2M17.8 16.2l2.2-6.6M8 20.6l12 -10.6\"></path><circle cx=\"7\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"10.5\" cy=\"8.5\" r=\"1.8\"></circle><circle cx=\"16.5\" cy=\"18\" r=\"1.8\"></circle><circle cx=\"21\" cy=\"9\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "head-and-shoulders",
            "label": "Head and shoulders",
            "shortcut": "",
            "svg": "<path d=\"M3.4 21l2.6-6M7.6 14l2-5.4M11.6 9l2 7M15.4 16l1.4-7.6M19 8.6l2 6M23 15l1.6 6M4 18.4h20\"></path><circle cx=\"14\" cy=\"6.5\" r=\"1.8\"></circle><circle cx=\"7\" cy=\"14\" r=\"1.8\"></circle><circle cx=\"21\" cy=\"14\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "abcd-pattern",
            "label": "ABCD pattern",
            "shortcut": "",
            "svg": "<path d=\"M7.4 20l4.4-10M13.4 9.6l5 10.2M10 7.4l9.6 .6M8 21l10 0\"></path><circle cx=\"7\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"12\" cy=\"8\" r=\"1.8\"></circle><circle cx=\"19\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"23\" cy=\"8\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "triangle-pattern",
            "label": "Triangle pattern",
            "shortcut": "",
            "svg": "<path d=\"M7.5 7l13 3.4M7.4 8.8l8 11M8.6 21l12.4-9.6\"></path><circle cx=\"7\" cy=\"7\" r=\"1.8\"></circle><circle cx=\"21\" cy=\"11\" r=\"1.8\"></circle><circle cx=\"16\" cy=\"21\" r=\"1.8\"></circle><circle cx=\"7\" cy=\"21\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "three-drives-pattern",
            "label": "Three drives pattern",
            "shortcut": "",
            "svg": "<path d=\"M5 20l3-9 3 5 3-8 3 7 3-4 3 8\"></path><circle cx=\"8\" cy=\"11\" r=\"1.6\"></circle><circle cx=\"14\" cy=\"8\" r=\"1.6\"></circle><circle cx=\"20\" cy=\"11\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Elliott waves",
        "rows": [
          {
            "id": "elliott-impulse-wave-12345",
            "label": "Elliott impulse wave (12345)",
            "shortcut": "",
            "svg": "<path d=\"M5 22l4-8 3 3 5-10 3 6 4-9\"></path><circle cx=\"9\" cy=\"14\" r=\"1.6\"></circle><circle cx=\"12\" cy=\"17\" r=\"1.6\"></circle><circle cx=\"17\" cy=\"7\" r=\"1.6\"></circle><circle cx=\"20\" cy=\"13\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "elliott-correction-wave-abc",
            "label": "Elliott correction wave (ABC)",
            "shortcut": "",
            "svg": "<path d=\"M5 8l7 10 4-5 7 9\"></path><circle cx=\"12\" cy=\"18\" r=\"1.6\"></circle><circle cx=\"16\" cy=\"13\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "elliott-triangle-wave-abcde",
            "label": "Elliott triangle wave (ABCDE)",
            "shortcut": "",
            "svg": "<path d=\"M4 9l5 8 4-6 3 7 3-5 5 6\"></path><circle cx=\"9\" cy=\"17\" r=\"1.6\"></circle><circle cx=\"13\" cy=\"11\" r=\"1.6\"></circle><circle cx=\"16\" cy=\"18\" r=\"1.6\"></circle><circle cx=\"19\" cy=\"13\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "elliott-double-combo-wave-wxy",
            "label": "Elliott double combo wave (WXY)",
            "shortcut": "",
            "svg": "<path d=\"M4 9l5 9 4-4 4 7 3-5 4 4\"></path><circle cx=\"9\" cy=\"18\" r=\"1.6\"></circle><circle cx=\"13\" cy=\"14\" r=\"1.6\"></circle><circle cx=\"17\" cy=\"21\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "elliott-triple-combo-wave-wxyxz",
            "label": "Elliott triple combo wave (WXYXZ)",
            "shortcut": "",
            "svg": "<path d=\"M3 9l4 7 3-3 3 7 3-6 3 4 3-5 3 5\"></path><circle cx=\"7\" cy=\"16\" r=\"1.6\"></circle><circle cx=\"13\" cy=\"20\" r=\"1.6\"></circle><circle cx=\"19\" cy=\"17\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Cycles",
        "rows": [
          {
            "id": "cyclic-lines",
            "label": "Cyclic lines",
            "shortcut": "",
            "svg": "<path d=\"M6 5v18M12 5v18M18 5v18M24 5v18\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "time-cycles",
            "label": "Time cycles",
            "shortcut": "",
            "svg": "<path d=\"M4 20a5 5 0 0 1 10 0M14 20a5 5 0 0 1 10 0M4 20h20\"></path><circle cx=\"9\" cy=\"15\" r=\"1.6\"></circle><circle cx=\"19\" cy=\"15\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "sine-line",
            "label": "Sine line",
            "shortcut": "",
            "svg": "<path d=\"M3 14c3-9 6-9 8 0s5 9 8 0 4-6 6-3\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "proj": {
    "key": "proj",
    "title": "Forecasting and measurement",
    "width": 283,
    "y": 413,
    "defaultTool": "long-position",
    "sections": [
      {
        "header": "Forecasting",
        "rows": [
          {
            "id": "long-position",
            "label": "Long position",
            "shortcut": "",
            "svg": "<path d=\"M5 6h18M13 14h10M5 22h18M7 9v6\"></path><text x=\"9\" y=\"13.5\" font-size=\"7\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">L</text>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "short-position",
            "label": "Short position",
            "shortcut": "",
            "svg": "<path d=\"M5 6h18M13 14h10M5 22h18M7 13v6\"></path><text x=\"9\" y=\"21.5\" font-size=\"7\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">S</text>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "position-forecast",
            "label": "Position forecast",
            "shortcut": "",
            "svg": "<path d=\"M7 4v4M7 13v4M7 8h0M5 8h4v5H5zM13 8v3M13 17v5M11 11h4v6h-4zM19 5v4M19 15v4M17 9h4v6h-4z\"></path><path d=\"M4 23h20\" stroke-dasharray=\"2 2\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "bars-pattern",
            "label": "Bars pattern",
            "shortcut": "",
            "svg": "<path d=\"M6 6v3M6 15v4M4 9h4v6H4zM12 11v3M12 20v3M10 14h4v6h-4zM18 8v4M18 18v3M16 12h4v6h-4z\"></path><path d=\"M22 6l2 2-2 2\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "ghost-feed",
            "label": "Ghost feed",
            "shortcut": "",
            "svg": "<path d=\"M4 12v4M4 21v2M2.5 16h3v5h-3zM10 8v3M10 17v3M8.5 11h3v6h-3zM16 11v3M16 20v2M14.5 14h3v6h-3zM22 6v3M22 15v3M20.5 9h3v6h-3z\"></path><path d=\"M4 5l6-1 6 2 6-2\" stroke-dasharray=\"1.5 2\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "sector",
            "label": "Sector",
            "shortcut": "",
            "svg": "<path d=\"M7 23V6M7 23h16M7 6a17 17 0 0 1 16 17\"></path><circle cx=\"7\" cy=\"6\" r=\"1.8\"></circle><circle cx=\"23\" cy=\"23\" r=\"1.8\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Volume-based",
        "rows": [
          {
            "id": "anchored-vwap",
            "label": "Anchored VWAP",
            "shortcut": "",
            "svg": "<path d=\"M5 20c3 0 4-5 7-5s4 3 6 3 3-6 5-6\"></path><circle cx=\"12\" cy=\"9\" r=\"1.8\"></circle><path d=\"M12 11v4\"></path><path d=\"M5 23h18\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "fixed-range-volume-profile",
            "label": "Fixed range volume profile",
            "shortcut": "",
            "svg": "<path d=\"M5 5v18M5 8h6M5 11h10M5 14h13M5 17h8M5 20h5M5 23h0\"></path><path d=\"M5 5h13M5 23h13\" stroke-dasharray=\"2 2\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "anchored-volume-profile",
            "label": "Anchored volume profile",
            "shortcut": "",
            "svg": "<circle cx=\"7\" cy=\"6\" r=\"1.8\"></circle><path d=\"M7 8v15M7 11h6M7 14h10M7 17h13M7 20h7\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Measurers",
        "rows": [
          {
            "id": "price-range",
            "label": "Price range",
            "shortcut": "",
            "svg": "<path d=\"M14 4v20M10.5 7.5L14 4l3.5 3.5M10.5 20.5L14 24l3.5-3.5M6 4h16M6 24h16\" stroke-dasharray=\"0\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "date-range",
            "label": "Date range",
            "shortcut": "",
            "svg": "<path d=\"M4 14h20M7.5 10.5L4 14l3.5 3.5M20.5 10.5L24 14l-3.5 3.5M4 6v16M24 6v16\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "date-and-price-range",
            "label": "Date and price range",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"5\" width=\"18\" height=\"18\"></rect><path d=\"M5 14h18M14 5v18M11.5 8l2.5-3 2.5 3M11.5 20l2.5 3 2.5-3M8 11.5L5 14l3 2.5M20 11.5l3 2.5-3 2.5\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "brush": {
    "key": "brush",
    "title": "Brushes, arrows and shapes",
    "width": 266,
    "y": 487,
    "defaultTool": "brush",
    "sections": [
      {
        "header": "Brushes",
        "rows": [
          {
            "id": "brush",
            "label": "Brush",
            "shortcut": "",
            "svg": "<path d=\"M21.5 6.5l-8.8 8.8 2 2 8.8-8.8a1.4 1.4 0 0 0 0-2 1.4 1.4 0 0 0-2 0z\"></path><path d=\"M12.2 15.8c-2.4-.4-4 1-4.4 3-.2 1-.8 1.7-2.3 2 3.4 1.6 7.2.6 8.2-2.2.3-.8.2-1.9-.6-2.4\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "highlighter",
            "label": "Highlighter",
            "shortcut": "",
            "svg": "<path d=\"M18 5l5 5-9 9-5-5z\"></path><path d=\"M9 14l-4 5 1.6 2.4H12l2-2M7 22h6\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Arrows",
        "rows": [
          {
            "id": "arrow-marker",
            "label": "Arrow marker",
            "shortcut": "",
            "svg": "<path d=\"M6 22l9-9\"></path><path d=\"M22 6l-4 .5-6 6 5 5 6-6z\" transform=\"translate(0 0)\"></path>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "arrow",
            "label": "Arrow",
            "shortcut": "",
            "svg": "<path d=\"M9.4 18.6L20 8M15 7.5h5.5V13\"></path><circle cx=\"8\" cy=\"20\" r=\"2\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "arrow-mark-up",
            "label": "Arrow mark up",
            "shortcut": "",
            "svg": "<path d=\"M14 5l-8 8h4.5v9h7v-9H22z\"></path>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "arrow-mark-down",
            "label": "Arrow mark down",
            "shortcut": "",
            "svg": "<path d=\"M14 23l-8-8h4.5V6h7v9H22z\"></path>",
            "hasStar": true,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Shapes",
        "rows": [
          {
            "id": "rectangle",
            "label": "Rectangle",
            "shortcut": "Alt + Shift + R",
            "svg": "<rect x=\"6\" y=\"6\" width=\"16\" height=\"16\"></rect><circle cx=\"6\" cy=\"6\" r=\"1.6\"></circle><circle cx=\"22\" cy=\"6\" r=\"1.6\"></circle><circle cx=\"6\" cy=\"22\" r=\"1.6\"></circle><circle cx=\"22\" cy=\"22\" r=\"1.6\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "rotated-rectangle",
            "label": "Rotated rectangle",
            "shortcut": "",
            "svg": "<path d=\"M14 5l9 9-9 9-9-9z\" transform=\"rotate(-18 14 14) scale(.86) translate(2.3 2.3)\"></path><circle cx=\"14\" cy=\"4.5\" r=\"1.6\"></circle><circle cx=\"23.5\" cy=\"14\" r=\"1.6\"></circle><circle cx=\"14\" cy=\"23.5\" r=\"1.6\"></circle><circle cx=\"4.5\" cy=\"14\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "path",
            "label": "Path",
            "shortcut": "",
            "svg": "<path d=\"M5 20l7-8 4 4 7-9\"></path><circle cx=\"5\" cy=\"20\" r=\"1.6\"></circle><circle cx=\"23\" cy=\"7\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "circle",
            "label": "Circle",
            "shortcut": "",
            "svg": "<circle cx=\"14\" cy=\"14\" r=\"9\"></circle><circle cx=\"14\" cy=\"14\" r=\"1.6\"></circle><circle cx=\"23\" cy=\"14\" r=\"1.6\"></circle>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "ellipse",
            "label": "Ellipse",
            "shortcut": "",
            "svg": "<ellipse cx=\"14\" cy=\"14\" rx=\"10\" ry=\"7\"></ellipse><circle cx=\"14\" cy=\"7\" r=\"1.6\"></circle><circle cx=\"24\" cy=\"14\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "polyline",
            "label": "Polyline",
            "shortcut": "",
            "svg": "<path d=\"M6 21l3-11 7 3 6-8-1 14z\"></path><circle cx=\"6\" cy=\"21\" r=\"1.6\"></circle><circle cx=\"9\" cy=\"10\" r=\"1.6\"></circle><circle cx=\"22\" cy=\"5\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "triangle",
            "label": "Triangle",
            "shortcut": "",
            "svg": "<path d=\"M14 6l9 16H5z\"></path><circle cx=\"14\" cy=\"6\" r=\"1.6\"></circle><circle cx=\"5\" cy=\"22\" r=\"1.6\"></circle><circle cx=\"23\" cy=\"22\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "arc",
            "label": "Arc",
            "shortcut": "",
            "svg": "<path d=\"M6 21a10 10 0 0 1 16 0M6 21h16\"></path><circle cx=\"6\" cy=\"21\" r=\"1.6\"></circle><circle cx=\"22\" cy=\"21\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "curve",
            "label": "Curve",
            "shortcut": "",
            "svg": "<path d=\"M5 21C8 6 18 6 23 12\"></path><circle cx=\"5\" cy=\"21\" r=\"1.6\"></circle><circle cx=\"23\" cy=\"12\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "double-curve",
            "label": "Double curve",
            "shortcut": "",
            "svg": "<path d=\"M4 18c4-14 8-14 10-4s6 8 10-4\"></path><circle cx=\"4\" cy=\"18\" r=\"1.6\"></circle><circle cx=\"24\" cy=\"10\" r=\"1.6\"></circle>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "text": {
    "key": "text",
    "title": "Text and notes",
    "width": 266,
    "y": 557,
    "defaultTool": "text",
    "sections": [
      {
        "header": "Text",
        "rows": [
          {
            "id": "text",
            "label": "Text",
            "shortcut": "Alt + Shift + T",
            "svg": "<path d=\"M8 8.5h12M14 8.5v12M12 20.5h4\"></path>",
            "hasStar": true,
            "hasHelp": false
          },
          {
            "id": "anchored-text",
            "label": "Anchored text",
            "shortcut": "",
            "svg": "<path d=\"M9 7.5h10M14 7.5v9M12 16.5h4M14 18.5v2.5M10.5 23h7M14 21a3.5 3.5 0 0 0 3.5 2\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "note",
            "label": "Note",
            "shortcut": "",
            "svg": "<path d=\"M6 6h16v12H13l-4 4v-4H6z\"></path><path d=\"M10 10h8M10 14h5\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "price-note",
            "label": "Price note",
            "shortcut": "",
            "svg": "<path d=\"M5 9h14l4 5-4 5H5z\"></path><path d=\"M9 14h6\"></path><circle cx=\"19\" cy=\"14\" r=\"1.2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "pin",
            "label": "Pin",
            "shortcut": "",
            "svg": "<path d=\"M14 24l-5-9a6 6 0 1 1 10 0z\"></path><circle cx=\"14\" cy=\"10.5\" r=\"2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "table",
            "label": "Table",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"6\" width=\"18\" height=\"16\"></rect><path d=\"M5 11h18M5 16.5h18M12 6v16\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "callout",
            "label": "Callout",
            "shortcut": "",
            "svg": "<path d=\"M7 6h14v9H15l-3 5-1-5H7z\"></path><path d=\"M11 9.5h6M11 12h4\"></path><circle cx=\"12\" cy=\"22.5\" r=\"1.2\"></circle>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "comment",
            "label": "Comment",
            "shortcut": "",
            "svg": "<path d=\"M14 6a8 7 0 1 0 0 14h.5l4 3v-3.6A7 7 0 0 0 14 6z\"></path><path d=\"M10.5 12h7M10.5 15h4\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "price-label",
            "label": "Price label",
            "shortcut": "",
            "svg": "<path d=\"M4 14l5-5h14v10H9z\"></path><path d=\"M13 12v4M13 14h6\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "signpost",
            "label": "Signpost",
            "shortcut": "",
            "svg": "<path d=\"M14 23V11M7 5h14v6H7z\"></path><path d=\"M10 8h8\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "flag-mark",
            "label": "Flag mark",
            "shortcut": "",
            "svg": "<path d=\"M8 5v18M8 6h13l-3 4.5 3 4.5H8\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      },
      {
        "header": "Content",
        "rows": [
          {
            "id": "image",
            "label": "Image",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"6\" width=\"18\" height=\"16\" rx=\"1.5\"></rect><circle cx=\"10.5\" cy=\"11.5\" r=\"1.8\"></circle><path d=\"M5 19l5.5-5 4 3.5 3-2.5 5.5 4.5\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "post",
            "label": "Post",
            "shortcut": "",
            "svg": "<rect x=\"5\" y=\"6\" width=\"18\" height=\"16\" rx=\"1.5\"></rect><circle cx=\"10\" cy=\"11\" r=\"2\"></circle><path d=\"M14 10h6M14 13h6M8 17h12\"></path>",
            "hasStar": false,
            "hasHelp": false
          },
          {
            "id": "idea",
            "label": "Idea",
            "shortcut": "",
            "svg": "<path d=\"M14 4.5a6.5 6.5 0 0 0-3.5 12v2.5h7v-2.5a6.5 6.5 0 0 0-3.5-12z\"></path><path d=\"M11 22.5h6\"></path>",
            "hasStar": false,
            "hasHelp": false
          }
        ]
      }
    ]
  },
  "emoji": {
    "key": "emoji",
    "title": "Icons and emojis",
    "width": 340,
    "y": 629,
    "defaultTool": "emoji-0",
    "isEmoji": true
  }
};

export const EMOJI_FACES = (() => {
  const eyes = [
    'M10 11.5h.01M18 11.5h.01',
    'M8.6 12.4q1.4-2.2 2.8 0M16.6 12.4q1.4-2.2 2.8 0',
    'M8.6 12.4q1.4-2.2 2.8 0M18 11.5h.01',
    'M8.8 11.8h2.6M16.6 11.8h2.6',
    'M9.2 10.4v2.2M18.8 10.4v2.2'
  ];
  const mouths = [
    'M9.5 17q4.5 4 9 0',
    'M9 16.5h10q-1 5-5 5t-5-5z',
    'M10 19h8',
    'M9.5 20q4.5-4 9 0',
    'M11 18.5q3 2 6 0',
    'M12 18.5a2 2.2 0 0 0 4 0z',
    'M9 16.5q5 5 10 0M9 16.5h10',
    'M10.5 18.5q3.5 3 7 0M17.5 18.5v1.8'
  ];
  const faces: { id: string; eyes: string; mouth: string }[] = [];
  for (let i = 0; i < 40; i++) {
    faces.push({
      id: `emoji-${i}`,
      eyes: eyes[(Math.floor(i / 8) + i * 2) % eyes.length]!,
      mouth: mouths[i % mouths.length]!
    });
  }
  return faces;
})();
