// Real SDK/Gateway/HTTP/Vite/Chromium; the provider is controlled, never the persisted history or HTTP payloads.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";

for (const key of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM", "PI_TEST_WEB_EVIDENCE"]) assert(process.env[key], `${key} required`);
const ports = [];
for (let port = 18790; port <= 18799 && ports.length < 2; port++) {
  if (port === 18797) continue;
  const available = await new Promise((done, reject) => {
    const server = createServer().once("error", (error) => error.code === "EADDRINUSE" ? done(false) : reject(error));
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });
  if (available) ports.push(port);
}
assert.equal(ports.length, 2, "Two isolated ports in 18790..18799 excluding 18797 are required");
const shots = resolve(process.env.PI_TEST_WEB_EVIDENCE);
const body = (kind, number) => (`HISTORY_${kind}_${String(number).padStart(3, "0")} ` + "history fixture ".repeat(30)).slice(0, 400);
const until = async (check, label) => {
  const deadline = Date.now() + 20_000;
  while (!await check()) { assert(Date.now() < deadline, `Timed out: ${label}`); await new Promise((done) => setTimeout(done, 25)); }
};
await withTargetFixture(async ({ config: connection, tempRoot, onCleanup }) => {
  const home = await mkdtemp(join(tmpdir(), "prk-full-history-"));
  let host, gateway, client, web, ui, browser;
  onCleanup(async () => {
    const failures = [];
    for (const close of [() => browser?.close(), () => ui?.close(), () => web?.close(), () => client?.disconnect(), () => gateway ? gateway.close() : host?.close()]) {
      try { await close(); } catch (error) { failures.push(error); }
    }
    await rm(home, { recursive: true, force: true });
    if (failures.length) throw new AggregateError(failures, "Full history cleanup failed");
  });
  const { agentDir } = initializePrkHome(home);
  await Promise.all([mkdir(shots, { recursive: true }), mkdir(agentDir, { recursive: true })]);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false, reserveTokens: 1024, keepRecentTokens: 2000 }, retry: { enabled: false } }));
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "full-history", models: [{ id: "controlled", contextWindow: 1_000_000 }], tokensPerSecond: 1_000_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const historyDir = join(home, "history");
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, targetCacheRoot: join(home, "target-cache"), session: { noExtensions: true, workerTools: "direct", localTools: false, idleTimeoutMs: 600000 } },
    { instances: [{ id: "fixture", label: "Full history fixture", ...connection, cwd: tempRoot }] });
  host = await createGatewayHost({ home, cwd: tempRoot, historyDir, config, model: "full-history/controlled" },
    { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: tempRoot, agentDir } });
  const socket = join(home, "g.sock");
  gateway = await startGateway(host, socket);
  client = await connectGateway(socket);
  await prepareGatewayEnvironment(host, home, "fixture");
  const name = (await client.request("createSession", { target: "fixture", label: "120 turns / two compactions" })).session.sessionId;
  const native = (action, args = {}) => client.request("nativeAction", { sessionId: name, requestId: `full-history-${action}-${crypto.randomUUID()}`, action, args });
  const send = async (number) => {
    provider.setResponses([fauxAssistantMessage(body("REPLY", number))]);
    const admitted = await host.session(name).submit({ requestId: `full-history-turn-${number}-${crypto.randomUUID()}`, message: body("TURN", number) });
    assert.equal(admitted.accepted, true);
    assert.equal((await admitted.completion).status, "completed");
  };
  for (let number = 1; number <= 120; number++) {
    await send(number);
    if (number === 60 || number === 110) {
      provider.setResponses([fauxAssistantMessage(`FULL_HISTORY_SUMMARY_${number}`)]);
      const compacted = await native("compact");
      assert.equal(compacted.status, "completed", JSON.stringify(compacted));
      assert(compacted.data.tokensBefore > 0);
    }
  }
  const saved = (await SessionManager.list(tempRoot, historyDir)).find(({ id }) => id === name);
  assert(saved, "Real SDK turns create a persisted session file");
  const manager = () => SessionManager.open(saved.path, historyDir, tempRoot);
  let branch = manager().getBranch();
  const userEntries = () => branch.filter((entry) => entry.type === "message" && entry.message.role === "user");
  let ids = userEntries().map(({ id }) => id);
  const compactions = branch.filter((entry) => entry.type === "compaction");
  assert.equal(ids.length, 120);
  assert.equal(compactions.length, 2);
  assert.deepEqual(compactions.map(({ firstKeptEntryId }) => firstKeptEntryId), [ids[50], ids[100]], "SDK cut points precede their compaction entries");
  assert(manager().buildSessionContext().messages.filter(({ role }) => role === "user").length < 50, "Model context stays compacted while the branch retains 120 turns");
  assert.equal(provider.state.callCount, 122, "120 real prompts and two real SDK summary calls");
  web = await startWebApplication({ home, socket, host: "127.0.0.1", port: ports[0] });
  ui = await startWebDev(web.server.url, { port: ports[1] });
  const http = async (suffix, method = "GET") => {
    const response = await fetch(`${web.server.url}/api/sessions/${encodeURIComponent(name)}/${suffix}`, { method, signal: AbortSignal.timeout(15000) });
    return { status: response.status, body: await response.json() };
  };
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname.endsWith("/history-page")) requests.push(request.url()); });
  page.setDefaultTimeout(20000);
  const users = page.locator("#messages .pi-message-user[data-entry-id]");
  const transcript = page.locator("#transcript");
  const settled = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const expectUsers = async (count) => {
    await page.waitForFunction((count) => document.querySelectorAll("#messages .pi-message-user[data-entry-id]").length === count, count);
    await settled();
    assert.deepEqual(await users.evaluateAll((nodes) => nodes.map((node) => node.dataset.entryId)), ids.slice(-count), "Loaded turns preserve raw branch order without duplicates");
  };
  const marker = (index) => page.locator(`.pi-history-compaction[data-entry-id="${compactions[index].id}"]`);
  const expectMarker = async (index) => assert(await marker(index).evaluate((node, id) => {
    const next = [...document.querySelectorAll("#messages .pi-message-user[data-entry-id]")].find((user) => node.compareDocumentPosition(user) & Node.DOCUMENT_POSITION_FOLLOWING);
    return next?.dataset.entryId === id;
  }, compactions[index].firstKeptEntryId), "Divider immediately precedes the SDK firstKept user, not the later compaction entry");
  const loadEarlier = async (count) => {
    let held;
    // Delay only delivery of the real Vite-proxied HTTP response, to measure a visible bubble before prepending.
    await page.route("**/history-page?*", async (route) => { held = { route, response: await route.fetch() }; }, { times: 1 });
    await transcript.hover();
    await page.mouse.wheel(0, -1_000_000);
    await until(() => held, "real history page response");
    assert.equal(held.response.status(), 200);
    const anchor = await transcript.evaluate((viewport) => {
      const bounds = viewport.getBoundingClientRect();
      const node = [...viewport.querySelectorAll(".pi-message-user[data-entry-id]")].find((node) => { const box = node.getBoundingClientRect(); return box.top >= bounds.top && box.bottom <= bounds.bottom; });
      return node && { id: node.dataset.entryId, top: node.getBoundingClientRect().top };
    });
    assert(anchor, "A fully visible user bubble must anchor the prepend");
    await held.route.fulfill({ response: held.response });
    await expectUsers(count);
    const top = await page.locator(`.pi-message-user[data-entry-id="${anchor.id}"]`).evaluate((node) => node.getBoundingClientRect().top);
    assert(Math.abs(top - anchor.top) <= 2, `Prepend moved visible user ${anchor.id} by ${top - anchor.top}px`);
    console.log(`History prepend to ${count} turns: ${Math.abs(top - anchor.top).toFixed(2)}px`);
  };
  await page.goto(ui.url, { waitUntil: "commit" });
  await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
  await expectUsers(50);
  assert.equal(await marker(0).count(), 0);
  assert.equal(await marker(1).count(), 1);
  await page.screenshot({ path: join(shots, "full-history-first-view.png"), animations: "disabled" });
  await marker(1).scrollIntoViewIfNeeded();
  await marker(1).locator("summary").click();
  assert((await marker(1).textContent()).includes("FULL_HISTORY_SUMMARY_110"));
  await marker(1).screenshot({ path: join(shots, "full-history-divider-zoom.png"), animations: "disabled" });
  await marker(1).locator("summary").click();
  await expectMarker(1); await loadEarlier(100);
  await expectMarker(0);
  await loadEarlier(120);
  const exhausted = requests.length;
  await transcript.hover(); await page.mouse.wheel(0, -1_000_000); await page.waitForTimeout(300);
  assert.equal(requests.length, exhausted, "Branch exhaustion stops history requests");
  await page.screenshot({ path: join(shots, "full-history-branch-start.png"), animations: "disabled" });
  const oldestTop = await users.first().evaluate((node) => node.getBoundingClientRect().top);
  await send(121);
  branch = manager().getBranch(); ids = userEntries().map(({ id }) => id);
  await expectUsers(121);
  assert(Math.abs(await users.first().evaluate((node) => node.getBoundingClientRect().top) - oldestTop) <= 2, "Live append preserves an older reader's viewport");
  await page.locator('#new-messages[data-kind="new"]').waitFor();
  const recent = page.locator(`.pi-message-user[data-entry-id="${ids[109]}"]`);
  await recent.evaluate((node) => node.scrollIntoView({ block: "center" }));
  const recentTop = await recent.evaluate((node) => node.getBoundingClientRect().top);
  await page.locator("#composer").fill("FULL_HISTORY_DRAFT"); await page.waitForTimeout(300);
  await page.reload({ waitUntil: "commit" }); await expectUsers(50);
  assert.equal(await page.locator("#composer").inputValue(), "FULL_HISTORY_DRAFT");
  assert(Math.abs(await recent.evaluate((node) => node.getBoundingClientRect().top) - recentTop) <= 2, "Refresh resets loaded pages but preserves a still-loaded visible anchor");
  const discarded = ids.at(-1);
  const reply119 = branch.find((entry) => entry.type === "message" && entry.message.role === "assistant" && JSON.stringify(entry.message.content).includes("HISTORY_REPLY_119")).id;
  assert.equal((await native("tree", { entryId: reply119 })).status, "completed");
  await send(120); branch = manager().getBranch(); ids = userEntries().map(({ id }) => id);
  assert.equal(ids.length, 120);
  assert.equal((await http(`history-page?before=${discarded}`)).status, 404, "An abandoned branch cursor is rejected");
  await page.locator(`[data-session-id="${name}"] [data-action="session-menu"]`).click();
  await page.locator("#archive-session").click();
  await page.locator('#management-dialog[data-kind="archive"] #confirm-archive').click();
  await page.locator(`.management-session-row[data-session-id="${name}"]`).waitFor({ state: "hidden" });
  const calls = provider.state.callCount, leaf = manager().getLeafId();
  const archived = await http("history");
  assert.equal(archived.status, 200); assert.equal(archived.body.readOnly, true); assert.equal(archived.body.snapshot.state, "closed");
  let cursor = archived.body.snapshot.historyBefore, seen = archived.body.snapshot.messageEntryIds;
  for (let pages = 0; cursor; pages++) { assert(pages < 3, "Archived paging must reach branch exhaustion"); const next = await http(`history-page?before=${cursor}`); assert.equal(next.status, 200); seen = [...next.body.messageEntryIds, ...seen]; cursor = next.body.historyBefore; }
  assert.deepEqual(seen, branch.filter((entry) => entry.type === "message").map(({ id }) => id), "Archived HTTP pages expose only the complete current branch");
  await page.locator("#open-settings").click(); await page.locator("#open-archive").click();
  await page.locator(`[data-archived="${name}"] [data-action="view-history"]`).click();
  await expectUsers(50); await expectMarker(1);
  await loadEarlier(100); await loadEarlier(120); await expectMarker(0);
  const archivedExhausted = requests.length;
  await transcript.hover(); await page.mouse.wheel(0, -1_000_000); await page.waitForTimeout(300);
  assert.equal(requests.length, archivedExhausted, "Archived branch exhaustion stops history requests");
  await recent.evaluate((node) => node.scrollIntoView({ block: "center" }));
  const archivedTop = await recent.evaluate((node) => node.getBoundingClientRect().top);
  await page.waitForTimeout(300); await page.reload({ waitUntil: "commit" }); await expectUsers(50);
  assert(Math.abs(await recent.evaluate((node) => node.getBoundingClientRect().top) - archivedTop) <= 2, "Archived refresh resets pages and preserves a still-loaded visible anchor");
  assert.equal(provider.state.callCount, calls, "Archived reads never call the model");
  assert.equal(manager().getLeafId(), leaf, "Read-only archived routes never advance the SDK leaf");
  assert.equal(host.history(name).snapshot.state, "closed"); assert.deepEqual(errors, []);
  console.log(execFileSync("ls", ["-la", ...["first-view", "divider-zoom", "branch-start"].map((part) => join(shots, `full-history-${part}.png`))], { encoding: "utf8" }));
  console.log("PASS full history: 120 real turns/two compactions, anchored live+archive paging, exhaustion, live append, refresh, branch-scoped read-only HTTP");
});
