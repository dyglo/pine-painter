import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const output = process.env.REPLAY_ARTIFACTS_DIR ?? "/tmp/deplyze-replay-artifacts";
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  // Keep provider bounds and displayed prices deterministic across verification dates.
  await page.clock.setFixedTime(new Date("2026-10-18T22:00:00Z"));
  const errors = [];
  let historyRequests = 0;
  let sockets = 0;
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGEERROR", e.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CONSOLE", msg.text().slice(0, 300));
  });
  const hour = 3600000;
  const origin = Date.UTC(2026, 8, 1);
  const candles = Array.from({ length: 1600 }, (_, i) => [
    origin + i * hour,
    String(10000 + i),
    String(10030 + i),
    String(9980 + i),
    String(10010 + i),
    "100",
    origin + (i + 1) * hour - 1,
    "0",
    10,
    "0",
    "0",
    "0",
  ]);
  await page.route("https://**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/ping")) return route.fulfill({ json: {} });
    if (url.pathname.endsWith("/exchangeInfo"))
      return route.fulfill({
        json: {
          symbols: url.hostname.startsWith("fapi")
            ? []
            : [
                {
                  symbol: "BTCUSDT",
                  status: "TRADING",
                  baseAsset: "BTC",
                  quoteAsset: "USDT",
                  filters: [{ filterType: "PRICE_FILTER", tickSize: "0.01" }],
                },
              ],
        },
      });
    if (url.pathname.endsWith("/klines")) {
      historyRequests++;
      const from = Number(url.searchParams.get("startTime") ?? 0);
      const to = Number(url.searchParams.get("endTime") ?? Date.UTC(2026, 9, 18, 22));
      const limit = Number(url.searchParams.get("limit") ?? 500);
      let data = candles.filter((b) => b[0] >= from && b[0] <= to);
      data = url.searchParams.has("startTime") ? data.slice(0, limit) : data.slice(-limit);
      return route.fulfill({ json: data });
    }
    if (url.pathname.endsWith("/products")) return route.fulfill({ json: [] });
    return route.abort();
  });
  await page.routeWebSocket(/.*/, () => {
    sockets++;
  });
  await page.goto(process.argv[2] ?? "http://localhost:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Replay", exact: true }).waitFor();
  await page.waitForTimeout(1200);
  const storageKey = "deplyze.replay.v1";
  const saved = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), storageKey);
  const settled = async () => {
    await page.waitForFunction(() => !document.querySelector('.html-native[aria-busy="true"]'));
    await page.waitForTimeout(150);
  };
  const workspace = page.locator(".html-workspace");
  const bounds = await workspace.boundingBox();
  assert(bounds);
  const reference = await browser.newPage({
    viewport: { width: Math.round(bounds.width), height: Math.round(bounds.height) },
  });
  const { readFile } = await import("node:fs/promises");
  const original = await readFile("docs/reference/tradingview-replay.html", "utf8");
  await reference.setContent(
    original.replace(
      "S.innerHTML=H;",
      "S.innerHTML=H;[...S.children].forEach((el,i)=>el.dataset.originalNode=i);",
    ),
  );
  const comparisons = [];
  async function compare(name, ids) {
    await page.waitForTimeout(150);
    const rootBox = await workspace.boundingBox();
    for (const id of ids) {
      const actual = await page.locator(`[data-source-node="${id}"]`).boundingBox(),
        expected = await reference.locator(`[data-original-node="${id}"]`).boundingBox();
      assert(actual && expected, `Missing source node ${id}`);
      for (const [key, offset] of [
        ["x", rootBox.x],
        ["y", rootBox.y],
        ["width", 0],
        ["height", 0],
      ])
        assert(
          Math.abs(actual[key] - offset - expected[key]) < 0.08,
          `${name} node ${id} ${key}: ${actual[key] - offset} != ${expected[key]}`,
        );
    }
    await workspace.screenshot({ path: join(output, `html-migrated-${name}.png`) });
    await reference.screenshot({ path: join(output, `html-original-${name}.png`) });
    comparisons.push({ name, nodes: ids.length });
  }
  const staticIds = [
    0, 1, 3, 4, 5, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 153, 154,
    155, 156, 157, 158, 159, 160, 161, 163, 164, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175,
    220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
  ];
  await compare("live", staticIds);
  await page.getByRole("button", { name: "Buy quote", exact: true }).click();
  await reference.evaluate("openPanel('buy')");
  await compare("order", [
    ...staticIds,
    2,
    176,
    178,
    179,
    180,
    181,
    182,
    183,
    184,
    185,
    186,
    188,
    190,
    191,
    192,
    193,
    194,
    195,
    196,
    197,
    199,
    200,
    201,
    202,
    203,
    205,
    206,
    207,
    208,
    209,
    210,
    211,
    212,
    214,
    215,
    217,
    219,
  ]);
  await page.getByLabel("Stop loss", { exact: true }).fill("10900");
  await page.getByLabel("Take profit", { exact: true }).fill("11400");
  await page.getByLabel("Risk amount", { exact: true }).fill("520");
  assert.equal(await page.getByLabel("Order quantity", { exact: true }).inputValue(), "2");
  assert.equal(await page.locator("#rr").textContent(), "0.92");
  await page.getByRole("button", { name: "Order type limit", exact: true }).click();
  await page.getByLabel("Order price", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Buy paper order", exact: true }).click();
  await page
    .locator(".source-toast")
    .filter({ hasText: "Order prices must be positive finite numbers." })
    .waitFor();
  assert.equal(await saved(), null, "Invalid price must not silently submit at the market price");
  await page.getByLabel("Order price", { exact: true }).fill("11160");
  for (const type of ["limit", "stop", "stop-limit", "market"])
    await page.getByRole("button", { name: `Order type ${type}`, exact: true }).click();
  await page.getByRole("button", { name: "Close trading panel", exact: true }).click();
  await page.getByRole("button", { name: "Go to date", exact: true }).click();
  await page.getByRole("button", { name: "Select 2026-10-10", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).waitFor();
  await settled();
  const initial = await saved();
  assert(initial);
  assert.equal(initial.dataset.symbol, "binance:BTCUSDT");
  const networkAtReplay = historyRequests,
    socketsAtReplay = sockets;
  await reference.evaluate(() => {
    st.replay = 1;
    st.panel = 0;
    ui();
  });
  await compare(
    "replay",
    staticIds.concat([21, 22, 23, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152]),
  );
  const chart = await page.locator(".source-chart").boundingBox();
  assert(chart);
  await page.getByRole("button", { name: "Select bar", exact: true }).click();
  await page.mouse.move(chart.x + chart.width * 0.55, chart.y + chart.height * 0.4);
  await page.locator(".source-selection-time").waitFor();
  await page.mouse.click(chart.x + chart.width * 0.55, chart.y + chart.height * 0.4);
  await settled();
  const selected = await saved();
  assert(selected.cursor < initial.cursor);
  await page.getByRole("button", { name: "Buy quote", exact: true }).click();
  await page.getByRole("button", { name: "Buy paper order", exact: true }).click();
  await page.getByText(/^Pending market/).waitFor();
  const submitted = await saved();
  assert.equal(submitted.trading.actions.length, 1);
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  await page.getByText("Long", { exact: true }).waitFor();
  assert.equal((await saved()).cursor, selected.cursor + 1);
  await page.screenshot({ path: join(output, "html-position.png"), fullPage: true });
  // Edit protection through the supplied inputs; changes must be in the ledger.
  const entryFill = (await saved()).dataset.bars[selected.cursor + 1].open * 1.0002;
  await page.getByLabel("Stop loss", { exact: true }).fill((entryFill - 3).toFixed(2));
  assert((await saved()).trading.actions.some((a) => a.order.amend));
  const beforeDrag = (await saved()).trading.actions.length;
  const chartBox = await page.locator(".source-chart").boundingBox();
  const capture = await page.locator(".source-chart").screenshot();
  const { execFileSync } = await import("node:child_process");
  const red = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        `from PIL import Image
from io import BytesIO
import sys,json
im=Image.open(BytesIO(sys.stdin.buffer.read())).convert('RGB');w,h=im.size
rows=[[(x,y) for x in range(int(w*.15),int(w*.8)) if (lambda c:c[0]>200 and c[1]<100 and c[2]<140)(im.getpixel((x,y)))] for y in range(int(h*.2),int(h*.9))]
r=max(rows,key=len)
assert len(r)>w*.15, 'No rendered SL line in the native chart'
print(json.dumps(r[len(r)//2]))`,
      ],
      { input: capture, encoding: "utf8" },
    ),
  );
  await page.mouse.move(chartBox.x + red[0], chartBox.y + red[1]);
  await page.mouse.down();
  await page.mouse.move(chartBox.x + red[0], chartBox.y + red[1] + 6, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(
    ({ key, count }) => JSON.parse(localStorage.getItem(key)).trading.actions.length > count,
    { key: storageKey, count: beforeDrag },
  );
  await page.screenshot({ path: join(output, "html-protection-drag.png"), fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  await page.getByText("No open position", { exact: false }).waitFor();
  const closed = await saved();
  assert(closed.trading.actions.some((a) => a.order === "close"));
  await page.getByRole("button", { name: "Close trading panel", exact: true }).click();
  await page.getByRole("button", { name: "Order context menu", exact: true }).click();
  await page.getByRole("button", { name: "Context order 460", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Order type stop", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Close trading panel", exact: true }).click();
  await page.getByRole("button", { name: "Open fib tools", exact: true }).click();
  await page.getByRole("button", { name: "Favorite Fib Retracement", exact: true }).click();
  await page.getByRole("button", { name: "Unfavorite Fib Retracement", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open proj tools", exact: true }).click();
  await page.getByRole("menuitem", { name: /Long Position/ }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open lines tools", exact: true }).click();
  await page.getByRole("menuitem", { name: /Horizontal Line/ }).click();
  await page.mouse.click(chart.x + chart.width * 0.6, chart.y + chart.height * 0.55);
  await page.waitForTimeout(900);
  const drawn = await saved();
  assert(drawn.chartState.drawings.drawings.some((d) => d.type === "hline"));
  // Native pan/zoom stays active, with drawings carried through an analytical step.
  await page.mouse.move(chart.x + chart.width * 0.6, chart.y + chart.height * 0.6);
  await page.mouse.wheel(0, -150);
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  assert((await saved()).chartState.drawings.drawings.some((d) => d.type === "hline"));
  await page.getByRole("button", { name: "Replay playback speed", exact: true }).click();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.waitForFunction(
    ({ key, cursor }) => JSON.parse(localStorage.getItem(key)).cursor > cursor,
    { key: storageKey, cursor: (await saved()).cursor },
  );
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Final replay candle", exact: true }).click();
  await settled();
  const ended = await saved();
  assert.equal(ended.cursor, ended.dataset.bars.length - 1);
  await page.waitForTimeout(500);
  assert.equal((await saved()).cursor, ended.cursor);
  assert.equal(historyRequests, networkAtReplay);
  assert.equal(sockets, socketsAtReplay);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restore session", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).waitFor();
  await settled();
  assert.equal((await saved()).dataset.id, ended.dataset.id);
  assert.deepEqual((await saved()).trading, ended.trading);
  await page
    .getByRole("navigation", { name: "Activity rail" })
    .getByRole("button", { name: "Pine editor", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Pine Script code" })
    .fill('//@version=5\nindicator("HTML migration check", overlay=true)\nplot(ta.sma(close,5))');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).scripts.some((s) =>
        s.source.includes("HTML migration check"),
      ),
    storageKey,
  );
  assert.equal((await saved()).scripts.length, 1);
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).click();
  await settled();
  assert(sockets > socketsAtReplay);
  await page.getByRole("button", { name: "Buy quote", exact: true }).click();
  const beforeResize = await page.locator(".source-chart").boundingBox();
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(300);
  const afterResize = await page.locator(".source-chart").boundingBox();
  assert(afterResize.width < beforeResize.width && afterResize.width > 150);
  await page.screenshot({ path: join(output, "html-responsive.png"), fullPage: true });
  const responsiveBox = await workspace.boundingBox();
  await reference.setViewportSize({
    width: Math.round(responsiveBox.width),
    height: Math.round(responsiveBox.height),
  });
  await reference.evaluate(() => {
    st.replay = 0;
    st.panel = 1;
    ui();
  });
  await compare(
    "responsive",
    staticIds.concat([
      2, 176, 178, 179, 180, 181, 182, 183, 184, 185, 186, 188, 190, 191, 192, 193, 194, 195, 196,
      197, 199, 200, 201, 202, 203, 205, 206, 207, 208, 209, 210, 211, 212, 214, 215, 217, 219,
    ]),
  );
  assert.deepEqual(errors, []);
  await (
    await import("node:fs/promises")
  ).writeFile(join(output, "html-comparison.json"), JSON.stringify(comparisons));
  console.log(
    JSON.stringify({
      status: "PASS",
      comparisons,
      checks: [
        "source layout geometry",
        "risk sizing and R:R",
        "all order tabs",
        "date selection",
        "native candle picker",
        "next-bar paper fills",
        "SL/TP amendment",
        "native SL drawing drag updates execution ledger",
        "context order menu",
        "drawing flyouts and favorites",
        "close",
        "native drawings persist",
        "native zoom",
        "play/pause and speed",
        "frozen completion",
        "restoration with paper ledger",
        "indicator replacement",
        "explicit exit",
        "responsive chart resize",
        "zero live data requests during replay",
        "no page errors",
      ],
    }),
  );
  await reference.close();
} finally {
  await browser.close();
}
