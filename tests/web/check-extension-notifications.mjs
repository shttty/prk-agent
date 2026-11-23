import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { projectConversation } from "../../web/chat/conversation/project-conversation.js";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
const root = await mkdtemp(join(tmpdir(), "prk-notify-"));
let host, gateway, client, web, ui, browser;
await withTargetFixture(async ({ config }) => {
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(join(agentDir, "extensions"), { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
  await writeFile(join(agentDir, "extensions/notifications.js"), `export default function(pi) {
    let turn = 0;
    pi.on("agent_settled", (_event, ctx) => ctx.ui.notify("ROUND_NOTICE_" + (++turn), "info"));
    pi.registerCommand("notify-burst", { description: "Notification classification regression", handler(_args, ctx) {
      for (const [message, type] of [["INFO_OLD", "info"], ["INFO_NEW", "info"], ["WARN_ONE", "warning"], ["WARN_TWO", "warning"], ["ERROR_ONE", "error"], ["ERROR_TWO", "error"], ["TAIL_OLD", "info"], ["TAIL_NEW", "info"]]) ctx.ui.notify(message, type);
    } });
  }`);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { startWebDev } = await import("../fixtures/web-dev.mjs");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "notification-controlled", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  runtime.registerNativeProvider(provider.provider);
  host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), targets: parseTargets([{ id: "fixture", label: "Fixture", ...config, cwd: root }]), model: "notification-controlled/controlled", config: parsePrkConfig({ session: { noExtensions: false } }) }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
  await prepareGatewayEnvironment(host, root, "fixture");
  gateway = await startGateway(host, join(root, "g.sock"));
  client = await connectGateway(join(root, "g.sock"));
  const main = await client.request("createSession", { target: "fixture" });
  const other = await client.request("createSession", { target: "fixture" });
  let request = 0;
  const send = async (message) => { const admitted = await host.session(main.session.sessionId).submit({ requestId: `notification-${++request}`, message }); assert(admitted.accepted); assert.equal((await admitted.completion).status, "completed"); };
  for (let turn = 1; turn <= 3; turn++) { provider.setResponses([fauxAssistantMessage(`ROUND_REPLY_${turn}`)]); await send(`ROUND_INPUT_${turn}`); }
  const state = host.state(main.session.sessionId);
  assert.deepEqual(state.extensionUi.notifications.map(item => item.message), ["ROUND_NOTICE_1", "ROUND_NOTICE_2", "ROUND_NOTICE_3"]);
  for (const [index, item] of state.extensionUi.notifications.entries()) { assert.equal(item.position, 3 + index * 2, "public SDK projection anchors each notification immediately after its reply"); assert.equal(item.sessionId, state.sessionId); }
  const project = (snapshot) => projectConversation({ selectedSessionId: main.session.sessionId, session: { snapshot, extensionUi: snapshot.extensionUi, toolRuns: new Map(), streams: new Map(), operations: new Map(), nativeFeedback: [] } });
  const rows = project(state);
  for (let turn = 1; turn <= 3; turn++) {
    const reply = rows.findIndex(item => item.content.some(part => part.text === `ROUND_REPLY_${turn}`));
    assert.equal(rows[reply + 1].metadata.custom.extensionNotification.message, `ROUND_NOTICE_${turn}`);
  }
  // While the reply is still a live stream the snapshot lags behind the notice position; the notice must stay after the reply throughout.
  const notice = state.extensionUi.notifications[0];
  const stage = (length, streams, operations = new Map()) => projectConversation({ selectedSessionId: main.session.sessionId, session: { snapshot: { ...state, messages: state.messages.slice(0, length), messageEntryIds: state.messageEntryIds.slice(0, length) }, extensionUi: { ...state.extensionUi, notifications: [notice] }, toolRuns: new Map(), streams, operations, nativeFeedback: [] } });
  const replyStream = () => new Map([["op-1", [{ afterTools: 0, text: "ROUND_REPLY_1" }]]]);
  for (const [label, rows] of [
    ["snapshot without prompt, streaming", stage(notice.position - 2, replyStream())],
    ["snapshot with prompt, streaming", stage(notice.position - 1, replyStream())],
    ["operation completed, snapshot not refreshed", stage(notice.position - 1, replyStream(), new Map([["op-1", { completion: { status: "completed" } }]]))],
    ["snapshot refreshed", stage(notice.position, new Map())],
    ["next reply streaming before its prompt reaches the snapshot", stage(notice.position, new Map([["op-2", [{ afterTools: 0, text: "ROUND_REPLY_2" }]]]))],
  ]) {
    const reply = rows.findIndex(item => item.content.some(part => part.text === "ROUND_REPLY_1"));
    assert.equal(rows[reply + 1]?.metadata.custom.extensionNotification?.id, notice.id, `${label}: notice directly after its reply`);
  }
  // A notice raised mid-turn (snapshot holds the tool step, the final text is live or already persisted) must not split the turn.
  const toolSteps = [{ role: "user", content: "TOOL_INPUT" }, { role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: {} }] }, { role: "toolResult", toolCallId: "call-1", content: [{ type: "text", text: "ok" }] }];
  const midTurn = (messages, streams) => projectConversation({ selectedSessionId: "s", session: { snapshot: { sessionId: "s", messages }, extensionUi: { notifications: [{ id: "mid", sessionId: "s", position: 3, message: "MID_NOTICE", type: "info", createdAt: 0 }] }, toolRuns: new Map(), streams, operations: new Map(), nativeFeedback: [] } });
  for (const rows of [midTurn(toolSteps, new Map([["op", [{ afterTools: 1, text: "TOOL_FINAL" }]]])), midTurn([...toolSteps, { role: "assistant", content: [{ type: "text", text: "TOOL_FINAL" }] }], new Map())]) {
    assert.deepEqual(rows.map(item => item.metadata?.custom?.extensionNotification ? "notice" : item.role), ["user", "assistant", "notice"], "mid-turn notice renders after the merged turn");
    assert.deepEqual(rows[1].content.map(part => part.type), ["tool-call", "text"]);
  }
  const before = state.messages;
  await send("/notify-burst");
  const burst = host.state(main.session.sessionId);
  assert.deepEqual(burst.messages, before, "notify never becomes SDK history/model input");
  assert.deepEqual(burst.extensionUi.notifications.map(item => item.message), ["ROUND_NOTICE_1", "ROUND_NOTICE_2", "INFO_NEW", "WARN_ONE", "WARN_TWO", "ERROR_ONE", "ERROR_TWO", "TAIL_NEW"], "only consecutive info at the same conversation boundary replaces; warnings/errors always append");
  console.log("PASS real SDK/Gateway: three reply anchors; consecutive info coalescing only; warning/error retained; SDK history unchanged");
  if (process.argv.includes("--browser")) {
    web = await startWebApplication({ socket: join(root, "g.sock"), host: "127.0.0.1", port: 0 }); ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      await page.goto(ui.url);
      const select = async name => { if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click(); await page.locator(`[data-session-id="${name}"] .management-session-select`).click(); };
      await select(main.session.sessionId);
      await page.locator('.pi-message [data-notification-type="error"]').first().waitFor();
      assert.equal(await page.locator('.pi-message [data-notification-type="info"]').count() > 0, true, "info stays as an anchored line");
      assert.equal(await page.locator('[data-toast-id][data-type="info"]').count(), 0, "info never pops a toast");
      assert.equal(await page.locator('[data-toast-id][data-type="error"]').count() > 0, true, "error still pops a toast");
      const observed = await page.locator('.pi-message').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, notice: node.querySelector('[data-notification-id]')?.textContent })));
      for (let turn = 1; turn <= 2; turn++) { const index = observed.findIndex(item => item.text.includes(`ROUND_REPLY_${turn}`)); assert.equal(observed[index + 1].notice, `ROUND_NOTICE_${turn}`); }
      const noticeCount = await page.locator('[data-notification-id]').count();
      await select(other.session.sessionId); assert.equal(await page.locator('[data-notification-id]').count(), 0);
      await select(main.session.sessionId); await page.waitForFunction(count => document.querySelectorAll('[data-notification-id]').length === count, noticeCount);
      await page.reload(); await page.waitForFunction(count => document.querySelectorAll('[data-notification-id]').length === count, noticeCount);
      if (process.env.PI_TEST_WEB_EVIDENCE) await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `notifications-${viewport.width}.png`), fullPage: true });
      console.log(`PASS browser ${viewport.width}: positioned notifications, switch/reconnect retained within live runtime, other session isolated`);
      await page.close();
    }
  }
  const firstReply = state.messageEntryIds[2];
  const navigated = await client.request("nativeAction", { sessionId: main.session.sessionId, requestId: "notification-tree", action: "tree", args: { entryId: firstReply } });
  assert.equal(navigated.status, "completed");
  assert.deepEqual(host.state(main.session.sessionId).extensionUi.notifications.map(item => item.message), ["ROUND_NOTICE_1"], "abandoned branch notices must not attach to another reply");
  await host.session(main.session.sessionId).reload();
  assert.deepEqual(host.state(main.session.sessionId).extensionUi.notifications, [], "SDK reload does not restore transient notify from history");
  console.log("PASS notification lifecycle: native tree hides abandoned anchors; reload clears runtime-only notices");
} finally { await browser?.close(); await ui?.close(); await web?.close(); await client?.disconnect(); if (gateway) await gateway.close(); else await host?.close(); await rm(root, { recursive: true, force: true }); }
});
