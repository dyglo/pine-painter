import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const output = process.env.REPLAY_ARTIFACTS_DIR ?? "artifacts/workspace-verification";
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(60000);
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
    if (url.origin === new URL(process.argv[2] ?? "http://localhost:3000").origin)
      return route.continue();
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
  await page.goto(process.argv[2] ?? "http://localhost:3000", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
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
  const sidebar = page.getByRole("navigation", { name: "Chart sidebar" });
  assert.deepEqual(
    await sidebar
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
    [
      "Watchlist",
      "Alerts",
      "Object tree",
      "AI Copilot",
      "Trade",
      "Indicators panel",
      "Calendar",
      "News feed",
      "Notifications",
      "Chats",
      "More apps",
      "Help",
    ],
  );
  for (const name of ["Calendar", "News feed", "Notifications", "Chats", "More apps", "Help"]) {
    assert.equal(
      await sidebar.getByRole("button", { name, exact: true }).getAttribute("aria-disabled"),
      "true",
    );
  }
  const help = await sidebar.getByRole("button", { name: "Help", exact: true }).boundingBox();
  assert.equal(help.y + help.height, 764);
  const agentSlot = await sidebar
    .getByRole("button", { name: "AI Copilot", exact: true })
    .boundingBox();
  assert.equal(agentSlot.y + agentSlot.height / 2, 368);

  await page.getByRole("button", { name: "AI Copilot", exact: true }).click();
  await page.getByText("Your chart is ready.", { exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole("textbox", { name: "Message Deplyze Quant" }).fill("Keep this draft");
  await page.getByLabel("AI model", { exact: true }).selectOption({ index: 1 });
  const selectedModel = await page.getByLabel("AI model", { exact: true }).inputValue();
  await page.screenshot({ path: join(output, "workspace-agent.png") });
  const opened = await page.locator(".source-chart").boundingBox();
  await page.getByRole("button", { name: "AI Copilot", exact: true }).click();
  const closed = await page.locator(".source-chart").boundingBox();
  assert(Math.abs(closed.width - opened.width - 360) < 1);
  assert.equal(await page.locator('[data-source-node="169"]').count(), 0);
  assert.equal(await page.locator(".source-position-status").count(), 0);
  assert.equal(await page.getByText("Replay Trading", { exact: true }).count(), 0);
  const drawingSize = await page.locator('[data-source-node="37"]').boundingBox();
  const lowerDrawing = await page.locator('[data-source-node="46"]').boundingBox();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(200);
  const wideDrawingSize = await page.locator('[data-source-node="37"]').boundingBox();
  assert.equal(wideDrawingSize.width, drawingSize.width);
  assert.equal(wideDrawingSize.height, drawingSize.height);
  assert.equal((await page.locator('[data-source-node="46"]').boundingBox()).y, lowerDrawing.y);
  assert.equal((await page.locator(".source-chart").boundingBox()).x, closed.x);
  await page.screenshot({ path: join(output, "workspace-wide-density.png") });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await page.getByLabel("Order quantity", { exact: true }).waitFor();
  await page.screenshot({ path: join(output, "workspace-trade.png") });
  await page.getByRole("button", { name: "Close trading panel", exact: true }).click();
  await page.getByRole("button", { name: "Indicators panel", exact: true }).click();
  await page.getByRole("textbox", { name: "Pine Script code" }).waitFor();
  await page.screenshot({ path: join(output, "workspace-indicators.png") });
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "AI Copilot", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Message Deplyze Quant" }).inputValue(),
    "Keep this draft",
  );
  assert.equal(await page.getByLabel("AI model", { exact: true }).inputValue(), selectedModel);
  await page.getByRole("button", { name: "AI Copilot", exact: true }).click();
  await page.screenshot({ path: join(output, "workspace-closed.png") });
  await page.getByRole("button", { name: "Go to date", exact: true }).click();
  await page.getByRole("button", { name: "Select 2026-10-10", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).waitFor();
  await settled();
  const initial = await saved();
  assert(initial);
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  const stepped = await saved();
  assert(stepped.cursor > initial.cursor);
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "AI Copilot", exact: true }).click();
  await page.waitForTimeout(200);
  assert(await page.getByRole("button", { name: "Next candle", exact: true }).isVisible());
  await page.getByRole("button", { name: "Next candle", exact: true }).click();
  await settled();
  await page.screenshot({ path: join(output, "workspace-replay-agent.png") });
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Exit Replay", exact: true }).click();
  await settled();
  assert(sockets > 0);
  await page.setViewportSize({ width: 1310, height: 717 });
  await page.waitForTimeout(200);
  const desktop = await workspace.boundingBox();
  assert.equal(desktop.x, 0);
  assert.equal(desktop.y, 0);
  assert.equal(desktop.width, 1310);
  assert.equal(desktop.height, 717);
  await page.screenshot({ path: join(output, "workspace-supplied-desktop.png") });
  await page.setViewportSize({ width: 989, height: 618 });
  await page.waitForTimeout(200);
  assert.equal((await page.locator(".source-chart").boundingBox()).x, closed.x);
  assert.equal(await page.locator('[data-source-node="169"]').count(), 0);
  const copilot = await page.getByRole("button", { name: "AI Copilot", exact: true }).boundingBox();
  const objectTree = await sidebar
    .getByRole("button", { name: "Object tree", exact: true })
    .boundingBox();
  assert(copilot.y >= objectTree.y + objectTree.height + 8);
  const smallHelp = await sidebar.getByRole("button", { name: "Help", exact: true }).boundingBox();
  assert.equal(smallHelp.y + smallHelp.height, 614);
  await page.mouse.move(25, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(200);
  const deleteDrawings = await page
    .getByRole("button", { name: "Delete drawings", exact: true })
    .boundingBox();
  assert(deleteDrawings.y + deleteDrawings.height <= 618);
  await page.screenshot({ path: join(output, "workspace-browser-comment-size.png") });
  assert.equal(errors.length, 0);
  console.log(
    JSON.stringify({
      viewport: bounds,
      closed,
      opened,
      replay: "date selection, step, play/pause, step while agent open, exit passed",
      errors,
    }),
  );
} finally {
  await browser.close();
}
