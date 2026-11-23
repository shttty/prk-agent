// The real composer in Chromium, driven through the scripted workbench HTTP/SSE boundary.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const send = Promise.withResolvers();
try {
  const { page, problems } = await openMockWorkbench(browser, server.url, {
    search: "#sessionId=w1", routes: { "/api/sessions/w1/send": () => send.promise },
  });
  let sequence = 1;
  const host = (type, details) => page.evaluate(({ type, details, sequence }) => {
    const source = window.__eventSources.findLast((item) => item.url.includes("/sessions/w1/events") && item.readyState === 1);
    source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify({ type, details, sequence, operationId: "op1", sessionId: "w1", streamId: "mock-w1" }) }));
  }, { type, details, sequence: ++sequence });
  const layout = () => page.locator("#transcript").evaluate((transcript) => ({
    viewport: transcript.clientHeight,
    composer: document.getElementById("composer-form").getBoundingClientRect().top,
  }));
  const captures = [];
  const capture = async (label) => captures.push([label, await layout()]);
  await page.locator("#composer").fill("fixture prompt");
  await page.evaluate(() => document.fonts.ready);
  const idle = await layout();
  await page.locator("#send-message").click();
  await page.locator("#operation-state[data-stage=sending]").waitFor();
  await page.locator('.pi-send-status[data-state="sending"]').waitFor();
  await capture("sending");
  send.resolve({ accepted: true, operationId: "op1" });
  await page.locator("#operation-state[data-stage=waiting]").waitFor();
  await page.locator('.pi-send-status[data-state="sending"]').waitFor({ state: "hidden" });
  await capture("running");
  const cell = { kernelId: "k1", cellId: "c1", taskName: "Fixture task", startedAt: Date.now(), status: "running" };
  await host("state_changed", { state: "running", kernel: { activeCells: [cell] } });
  await page.locator("#background-tasks").waitFor();
  await capture("running with background task");
  await page.locator("#background-tasks-toggle").click();
  await page.locator("#background-task-list").waitFor();
  await capture("expanded background tasks");
  await host("operation_completed", { status: "completed" });
  await page.locator("#operation-bar").waitFor({ state: "hidden" });
  await capture("completed with background task");
  await host("state_changed", { state: "idle", kernel: { activeCells: [] } });
  await page.locator("#background-tasks").waitFor({ state: "hidden" });
  await capture("idle again");
  assert.deepEqual(captures, captures.map(([label]) => [label, idle]), "send, run and background-task feedback preserve chat geometry");
  assert.deepEqual(problems, []);
  console.log(`PASS composer stability: ${JSON.stringify(captures)}`);
} finally {
  send.resolve({ accepted: false });
  await browser.close();
  await server.close();
}
