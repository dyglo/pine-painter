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
      const to = Number(url.searchParams.get("endTime") ?? Date.now());
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
  await page
    .getByRole("button", { name: "Enter Replay", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForTimeout(1500);
  const storageKey = "deplyze.replay.v1";
  const saved = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), storageKey);
  const settled = async () => {
    await page.waitForFunction(() => !document.querySelector(".replay-calculating"));
    await page.waitForTimeout(200);
  };
  await page.getByLabel("Historical closed candle time in UTC").fill("2026-10-10T12:00");
  await page.getByRole("button", { name: "Enter Replay", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).waitFor();
  await settled();
  const first = await saved();
  assert(first);
  assert.equal(first.dataset.symbol, "binance:BTCUSDT");
  const networkAtReplay = historyRequests;
  const socketsAtReplay = sockets;
  await page.screenshot({ path: join(output, "replay-paused.png"), fullPage: true });
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  assert.equal((await saved()).cursor, first.cursor + 1);
  await page.getByRole("button", { name: "Previous candle", exact: true }).click();
  await settled();
  assert.equal((await saved()).cursor, first.cursor);
  await page.getByLabel("Replay playback speed").selectOption("5");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.waitForFunction(
    ({ key, cursor }) => JSON.parse(localStorage.getItem(key)).cursor > cursor,
    { key: storageKey, cursor: first.cursor },
  );
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await settled();
  const played = await saved();
  assert(played.cursor > first.cursor);
  await page.getByRole("button", { name: "Final replay candle", exact: true }).click();
  await settled();
  const ended = await saved();
  assert.equal(ended.cursor, ended.dataset.bars.length - 1);
  await page.getByText("Complete · frozen", { exact: true }).waitFor();
  await page.waitForTimeout(1500);
  assert.equal((await saved()).cursor, ended.cursor);
  assert.equal(historyRequests, networkAtReplay);
  assert.equal(sockets, socketsAtReplay);
  await page.screenshot({ path: join(output, "replay-complete.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restore session", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).waitFor();
  await settled();
  assert.equal((await saved()).dataset.id, ended.dataset.id);
  assert.equal((await saved()).cursor, ended.cursor);
  await page.getByText("Complete · frozen", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Previous candle", exact: true }).click();
  await settled();
  assert.equal((await saved()).cursor, ended.cursor - 1);
  // The original agent runner must still replace one logical indicator after a
  // workspace rebuild and session restoration. No model/gateway call is made.
  await page
    .getByRole("navigation", { name: "Activity rail" })
    .getByRole("button", { name: "Pine editor", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Pine Script code" })
    .fill('//@version=5\nindicator("Restored replacement", overlay=true)\nplot(ta.sma(close, 5))');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key)).scripts.some((s) =>
        s.source.includes("Restored replacement"),
      ),
    storageKey,
  );
  const replacement = await saved();
  assert.equal(replacement.scripts.length, 1);
  assert(replacement.scripts[0].source.includes("Restored replacement"));
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  assert.equal((await saved()).scripts.length, 1);
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();

  await page.getByRole("button", { name: "Exit Replay", exact: true }).click();
  await page.getByRole("button", { name: "Enter Replay", exact: true }).waitFor();
  await settled();
  assert(sockets > socketsAtReplay, "Explicit exit must restore the original live subscription");
  await page.setViewportSize({ width: 900, height: 800 });
  await page.screenshot({ path: join(output, "replay-live.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "PASS",
      initialCursor: first.cursor,
      pausedAfterPlay: played.cursor,
      finalCursor: ended.cursor,
      dataset: ended.dataset.id,
      historyRequestsDuringReplay: 0,
      socketsDuringReplay: 0,
      checks: [
        "date selection",
        "next/previous",
        "play/pause",
        "speed",
        "frozen completion",
        "dataset restoration",
        "explicit exit",
        "no page errors",
      ],
    }),
  );
} finally {
  await browser.close();
}
