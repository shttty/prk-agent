// Optional fields the web reads before the backend sends them (docs/wire/sessions.md「前端已支持，后端待实现」), on the
// mocked workbench: the 子会话档位 control (`delegation`, a session setting in 会话详情) and child run time (`startedAt` /
// `finishedAt`) appear only when the field is present, and the control calls native action `delegation {level}`. No copy
// is asserted.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS, SESSIONS, snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { closeSessionDetails, openSessionDetails } from "../fixtures/session-details.mjs";

const G = 1024 ** 3;
const monitor = { state: "ok", intervalMs: 30000, alerts: {}, machine: { cpu: { pct: 10, cores: 8 }, load: [0.5, 0.5, 0.5], mem: { total: 16 * G, available: 8 * G }, disk: { total: 500 * G, free: 200 * G }, gpus: [], ageMs: 2000 } };
const now = Date.now();
const child = (sessionId, extra) => ({ label: sessionId, sessionId, state: "idle", target: "alpha", cwd: "/data", ...extra });
const sessions = [
  { ...SESSIONS[0], monitor },
  child("timed", { state: "running", startedAt: now - 90_000, derivation: { owner: "w1", createdBy: "w1", phase: "working", lifecycle: "temporary" } }),
  child("done", { startedAt: now - 600_000, finishedAt: now - 60_000, derivation: { owner: "w1", createdBy: "w1", phase: "submitted", lifecycle: "temporary" } }),
  child("untimed", { state: "running", derivation: { owner: "w1", createdBy: "w1", phase: "working", lifecycle: "temporary" } }),
  ...SESSIONS.slice(1),
];
const catalog = { version: 1, target: { current: { toolMode: "code" } }, commands: [], actions: [], inputPrefixes: [], resources: [], attachments: { enabled: false, imageMimeTypes: [] }, references: { targetFile: { enabled: false, candidates: [] } } };
const posts = [];
const native = (body) => { if (!body.action) return catalog; posts.push(body); return { requestId: body.requestId, action: body.action, status: "completed", message: "ok", data: { delegation: body.args?.level } }; };
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, delegation: "restrained" }, timed: snapshotOf("timed", "running"), done: snapshotOf("done", "idle"), untimed: snapshotOf("untimed", "running") };
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const h = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes: { "/api/sessions/w1/native": native, "/api/sessions/w2/native": native } });
  const { page } = h;
  await selectSession(page, "w1");
  // delegation present: the setting is in 会话详情 (not under the composer), shows the level, and a change goes out as
  // native `delegation {level}`
  assert.equal(await page.locator("#composer-meta #chat-delegation-select").count(), 0, "not under the composer");
  await openSessionDetails(page, "w1");
  const select = page.locator("#chat-delegation-select");
  await select.waitFor();
  assert.equal(await select.inputValue() !== "", true, "the reported level is selected");
  await select.click();
  await page.locator('[role="option"]:has([data-delegation="eager"])').click();
  const changes = () => posts.filter(({ action }) => action === "delegation");
  for (let tries = 0; tries < 50 && !changes().length; tries += 1) await page.waitForTimeout(50);
  assert.deepEqual(changes().map(({ action, args }) => ({ action, args })), [{ action: "delegation", args: { level: "eager" } }]);
  await closeSessionDetails(page);
  // run time: running with startedAt, total with finishedAt, nothing without startedAt
  if ((await page.locator("#toggle-monitor").getAttribute("aria-pressed")) !== "true") await page.locator("#toggle-monitor").click();
  await page.locator("#monitor-children").waitFor();
  const timeOf = (name) => page.locator(`#monitor-children [data-child="${name}"] [data-run-time]`);
  assert.equal(await timeOf("timed").getAttribute("data-run-time"), "running");
  assert.equal(await timeOf("done").getAttribute("data-run-time"), "total");
  assert.equal(await timeOf("untimed").count(), 0, "no startedAt: state only");
  // delegation absent (another session): no control at all
  await selectSession(page, "w2");
  await openSessionDetails(page, "w2");
  await page.locator("#queue-select").waitFor();
  assert.equal(await page.locator("#chat-delegation-select").count(), 0, "no delegation field: no control");
  await closeSessionDetails(page);
  assert.deepEqual(h.problems.filter((problem) => !problem.startsWith("download failed (font-family")), []);
  await h.context.close();
  console.log("PASS pending fields: delegation control and child run time only with their fields");
} finally {
  await browser.close();
  await server.close();
}
