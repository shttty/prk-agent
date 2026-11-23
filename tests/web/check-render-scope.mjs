// Render scope (check:quick): live stream deltas re-render only the live message, never the finalized ones.
// Counts React renders through a test-only DevTools hook (fixtures/workspace-mock/render-counter.mjs).
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { installRenderCounter, readCommits, readRenderCounts, resetRenderCounts, sumCounts } from "../fixtures/workspace-mock/render-counter.mjs";

const now = Date.now();
const messages = [
  { role: "user", content: [{ type: "text", text: "first question" }], timestamp: now - 9000 },
  { role: "assistant", content: [{ type: "text", text: "looking" }, { type: "toolCall", id: "t1", name: "kernel_code", arguments: { code: "print(1)" } }], timestamp: now - 8000, stopReason: "toolUse" },
  { role: "toolResult", toolCallId: "t1", toolName: "kernel_code", content: [{ type: "text", text: "1" }], timestamp: now - 7000 },
  { role: "assistant", content: [{ type: "text", text: "first answer **done**" }], timestamp: now - 6000, stopReason: "stop" },
  { role: "user", content: [{ type: "text", text: "second question" }], timestamp: now - 5000 },
  { role: "assistant", content: [{ type: "text", text: "second answer" }], timestamp: now - 4000, stopReason: "stop" },
  // The prompt being answered: the live turn starts after it instead of merging into the previous answer.
  { role: "user", content: [{ type: "text", text: "third question" }], timestamp: now - 3000 },
];
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
const DELTAS = 20;
const TICKS = 10;
const KEYS = 10;
// Regions that must stay quiet (0 renders) in each scenario; grows as regions move to their own subscriptions.
const QUIET = {
  stream: ["app", "topbar", "sidebar", "monitor", "composer", "composer-meta"],
  tick: ["app", "topbar", "sidebar"],
  type: ["app", "topbar", "sidebar", "monitor", "chat", "composer-meta"],
  // Stream deltas while the settings window is open.
  settings: ["settings"],
  // A collection event that changes another session's row (monitor sample of w2).
  row: ["app", "topbar", "chat", "messages", "composer", "composer-meta"],
};
// The chat column as a whole: its own components, the composer row and every message.
const chatArea = (scope) => ["chat", "aui-runtime", "composer", "composer-meta"].includes(scope) || scope.startsWith("message:");

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  // Page time is Playwright's fake clock (public Clock API): it flows normally while the page loads, then is paused and only
  // advanced by the test. Date, timers and requestAnimationFrame all move together (the streaming text animation needs Date
  // to advance), so each counted window can start right after the monitor's own 1 s ticker fired and end before the next.
  const installClock = async (page) => { await installRenderCounter(page); await page.clock.install({ time: new Date(now) }); };
  const { context, page, problems } = await openMockWorkbench(browser, server.url, { snapshots, beforeGoto: installClock });
  await selectSession(page, "w1");
  await page.locator('.pi-message[data-message-id]').first().waitFor();
  const finalized = await page.locator(".pi-message[data-message-id]").evaluateAll((nodes) => nodes.map((node) => node.dataset.messageId));
  assert(finalized.length >= 3, "the finalized transcript renders");
  const host = (type, details, extra = {}) => page.evaluate(({ type, details, extra }) => {
    window.__sequence = (window.__sequence ?? 1) + 1;
    const source = window.__eventSources.find((item) => item.url.includes("/sessions/w1/events"));
    source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify({ type, streamId: "mock-w1", sessionId: "w1", sequence: window.__sequence, details, ...extra }) }));
  }, { type, details, extra });
  // Two animation frames of page time (the clock fires a frame every 16 ms).
  const frames = () => page.clock.runFor(32);
  // A paused page only moves when the clock is advanced: advance frame by frame until the condition holds (bounded).
  const until = async (locator, state = "visible", budgetMs = 3000) => {
    const holds = async () => (state === "attached" ? (await locator.count()) > 0 : state === "hidden" ? !(await locator.isVisible()) : locator.isVisible());
    for (let spent = 0; spent <= budgetMs; spent += 16) { if (await holds()) return; await page.clock.runFor(16); }
    throw new Error(`page time ran ${budgetMs} ms without ${state}: ${locator}`);
  };
  const pageNow = () => page.evaluate(() => Date.now());
  let commits = [];
  const windows = [];
  // First page time passes as it would between two steps, so chains started by the previous step (a dialog's enter
  // transition schedules its next timer only when the previous one fires) finish outside the window. Then jumping more than
  // 1 s fires the monitor ticker (setInterval 1000) exactly at the jump point; its next tick is 1000 ms later. The ticker's
  // commit lands before the reset (real time lets React's scheduler finish), so a window holds only the scenario.
  const counted = async (run, label) => {
    await page.clock.runFor(500);
    await page.clock.fastForward(1001);
    const tickAt = await pageNow();
    await frames();
    await page.waitForTimeout(100);
    await resetRenderCounts(page);
    await run();
    await frames();
    const span = (await pageNow()) - tickAt;
    windows.push({ label, msAfterTicker: span });
    assert(span < 1000, `${label}: the counted window (${span} ms of page time) ends before the monitor's next 1 s tick`);
    commits = await readCommits(page);
    return readRenderCounts(page);
  };
  // Every scenario runs; the regions that should have stayed quiet are reported together at the end. With a
  // `trigger`, only commits where that region rendered too count, so a region's own clock (the monitor's 1 s ticker,
  // a separate commit) is not blamed on the store update.
  const loudRegions = [];
  const quiet = (scenario, trigger) => {
    for (const scope of QUIET[scenario]) {
      // `messages`: every message scope together.
      const inScope = (key) => (scope === "messages" ? key.startsWith("message:") : key === scope);
      const renders = commits.filter((commit) => !trigger || commit[trigger]).reduce((total, commit) => total + sumCounts(commit, inScope), 0);
      if (renders) loudRegions.push(`${scenario}: ${scope}=${renders}`);
    }
  };
  if (await page.locator("#toggle-monitor").getAttribute("aria-pressed") !== "true") await page.locator("#toggle-monitor").click();
  await page.locator("#monitor-kernel").waitFor();

  // One delta first so the live message exists, then count only the following ones.
  await host("message", undefined, { operationId: "op1", text: "chunk-0 " });
  await page.locator('.pi-message[data-message-id="live-op1"]').waitFor();
  await page.clock.pauseAt((await pageNow()) + 1000);
  const counts = await counted(async () => {
    for (let index = 1; index <= DELTAS; index++) { await host("message", undefined, { operationId: "op1", text: `chunk-${index} ` }); await frames(); }
    await until(page.locator('.pi-message[data-message-id="live-op1"]', { hasText: `chunk-${DELTAS}` }));
    await page.locator('.pi-message[data-message-id="live-op1"]', { hasText: `chunk-${DELTAS}` }).waitFor();
  }, "stream");
  const stale = finalized.filter((id) => counts[`message:${id}`]).map((id) => `${id}=${counts[`message:${id}`]}`);
  assert.deepEqual(stale, [], `finalized messages re-rendered during ${DELTAS} stream deltas`);
  assert(counts["message:live-op1"] > 0, "the live message re-renders");
  quiet("stream", "message:live-op1");
  console.log(`PASS render scope: ${DELTAS} stream deltas re-render only the live message among messages (${counts["message:live-op1"]} renders)`);

  // Kernel telemetry ticks update the monitor's kernel reading and nothing in the chat.
  const tick = (index) => host("state_changed", { kernel: { kernelId: "k1", state: "busy", connectionStatus: "connected", memory: { workingSet: 100_000_000 + index } } });
  await tick(0);
  await until(page.locator('#monitor-kernel-memory [data-used-bytes="100000000"]'));
  await page.locator('#monitor-kernel-memory [data-used-bytes="100000000"]').waitFor();
  const tickCounts = await counted(async () => {
    for (let index = 1; index <= TICKS; index++) { await tick(index); await frames(); }
    await until(page.locator(`#monitor-kernel-memory [data-used-bytes="${100_000_000 + TICKS}"]`));
    await page.locator(`#monitor-kernel-memory [data-used-bytes="${100_000_000 + TICKS}"]`).waitFor({ timeout: 5000 });
  }, "tick");
  assert.equal(sumCounts(tickCounts, chatArea), 0, `the chat re-rendered during ${TICKS} kernel telemetry ticks`);
  quiet("tick");
  console.log(`PASS render scope: ${TICKS} kernel telemetry ticks update the monitor without rendering the chat`);

  // Typing re-renders the composer and nothing that does not read the draft.
  await page.locator("#composer").click();
  const typeCounts = await counted(async () => {
    for (let index = 0; index < KEYS; index++) { await page.keyboard.type("x"); await frames(); }
    assert.equal(await page.locator("#composer").inputValue(), "x".repeat(KEYS));
  }, "type");
  assert(typeCounts.composer > 0, "the composer re-renders while typing");
  quiet("type", "composer");

  // The settings window (open) reads none of the streaming fields.
  await page.locator("#open-settings").click();
  await until(page.locator('#settings-content[data-section="general"]'));
  await page.locator('#settings-content[data-section="general"]').waitFor();
  await counted(async () => {
    for (let index = 1; index <= DELTAS; index++) { await host("message", undefined, { operationId: "op1", text: `more-${index} ` }); await frames(); }
    await until(page.locator('.pi-message[data-message-id="live-op1"]', { hasText: `more-${DELTAS}` }), "attached");
    await page.locator('.pi-message[data-message-id="live-op1"]', { hasText: `more-${DELTAS}` }).waitFor({ state: "attached" });
  }, "settings");
  quiet("settings", "message:live-op1");
  await page.locator("#close-settings").click();
  await until(page.locator("#settings-content"), "hidden");
  await page.locator("#settings-content").waitFor({ state: "hidden" });

  // Another session's row changes (a monitor sample on the collection stream): only the session list re-renders.
  const rowEvent = (index) => page.evaluate((index) => {
    const source = window.__eventSources.find((item) => item.url.endsWith("/api/sessions/events"));
    source.dispatchEvent(new MessageEvent("collection", { data: JSON.stringify({ type: "session_monitor", sessionId: "w2", details: { monitor: { state: "ok", sample: index } } }) }));
  }, index);
  const rowCounts = await counted(async () => { for (let index = 0; index < TICKS; index++) { await rowEvent(index); await frames(); } }, "row");
  assert(rowCounts.sidebar > 0, "the session list re-renders for a row event");
  quiet("row", "sidebar");
  assert.deepEqual(loudRegions, [], "regions that do not read the changed data re-rendered");
  console.log(`PASS render scope: quiet regions ${JSON.stringify(QUIET)}`);
  console.log(`render scope windows (page ms after the monitor tick): ${JSON.stringify(windows)}`);
  assert.deepEqual(problems, [], "page errors");
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
