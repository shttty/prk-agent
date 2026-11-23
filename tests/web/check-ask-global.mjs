// A worker's ask, seen from another session, in a real browser on the real path (check:full): a faux model in a code-mode
// worker (real Pi SDK + test Gateway + owned Jupyter fixture) calls `gateway.ask` from a kernel cell while the page shows
// ANOTHER session. The sidebar row (and the drawer on a phone) marks the waiting session, a folded group says so too, the
// tab title is marked and a system notification is raised while the page is away; the notification selects the worker,
// whose own card is answered, and the cell gets the answer. Desktop 1440 and phone 390, light and dark; nothing here locates
// by UI copy (ids, data-*). Screenshots go to PI_TEST_WEB_EVIDENCE when it is set.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, check, label, timeoutMs = 20_000) {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (check(value)) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await sleep(25);
  }
}
const isPhone = (viewport) => viewport.width < 600;

const QUESTIONS = [{ id: "storage", header: "Storage", question: "Which database should the worker use?", recommended: 1, options: [{ label: "SQLite", description: "single file" }, { label: "Postgres", description: "networked" }] }];
const CELL = `answer = gateway.ask(questions=${JSON.stringify(QUESTIONS)})\nprint("CELL_GOT<<" + answer + ">>")`;

/** The page is "in the background" or "in front" as far as the document can tell; notifications are recorded. */
const FAKE_BROWSER = () => {
  localStorage.setItem("pi.ask.notify", "1");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (window.__front === false ? "hidden" : "visible") });
  document.hasFocus = () => window.__front !== false;
  window.__notes = [];
  const instances = [];
  class FakeNotification {
    constructor(title, options) { this.entry = { title, ...options, closed: false }; window.__notes.push(this.entry); instances.push(this); }
    close() { this.entry.closed = true; }
    static permission = "granted";
    static async requestPermission() { return "granted"; }
  }
  window.__clickNote = (index) => instances[index].onclick?.();
  window.Notification = FakeNotification;
};
const setFront = (page, front) => page.evaluate((visible) => { window.__front = visible; document.dispatchEvent(new Event("visibilitychange")); }, front);

const stacks = [];
let browser;
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { parseTargets } = await import("./target-instances/parse-targets.mjs");
await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-ask-global-"));
  onCleanup(async () => {
    await browser?.close();
    for (const entry of stacks) await entry.close();
    await rm(root, { recursive: true, force: true });
  });
  const { agentDir } = initializePrkHome(root);
  const workerCwd = join(root, "session-cwd");
  await mkdir(workerCwd);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { startWebDev } = await import("../fixtures/web-dev.mjs");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "ask-global", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });
  runtime.registerNativeProvider(provider.provider);
  const contexts = [];
  provider.setResponses(Array.from({ length: 300 }, () => async (context) => {
    contexts.push(context);
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("CELL_TURN_DONE");
    const cell = /^CELL (\{.*\})$/s.exec(text(last));
    if (cell) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: JSON.parse(cell[1]).code, title: "ask cell" }), { stopReason: "toolUse" });
    return fauxAssistantMessage("PLAIN_REPLY");
  }));
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });

  // One Gateway: a main (the session on screen) and a code-mode worker on the fixture; its web API and a Vite UI.
  const dir = await mkdtemp(join(root, "stack-"));
  const host = await createGatewayHost({
    cwd: dir, home: dir, historyDir: join(dir, "history"), model: "ask-global/controlled",
    targets: parseTargets([{ id: "local", label: "Local", ...config, cwd: workerCwd }]),
    config: parsePrkConfig({ monitor: { enabled: false }, session: { workerTools: "code" } }),
  }, { runtimeDependencies: { cwd: dir, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
  const gateway = await startGateway(host, join(dir, "g.sock"));
  const client = await connectGateway(join(dir, "g.sock"));
  const viewed = (await client.request("createSession", { target: "local", label: "viewed" })).session.sessionId;
  const worker = (await host.createSession({ target: "local", cwd: workerCwd, label: "asker" })).session.sessionId;
  const web = await startWebApplication({ socket: join(dir, "g.sock"), host: "127.0.0.1", port: 0 });
  const ui = await startWebDev(web.server.url);
  stacks.push({ close: async () => { await ui.close(); await web.close(); client.disconnect(); await gateway.close(); } });
  const prompts = () => host.state(worker).extensionUi.prompts.filter((prompt) => prompt.kind === "ask");
  const shot = async (page, name) => { if (evidence) await page.screenshot({ path: join(evidence, `${name}.png`) }); };

  for (const [label, viewport, scheme] of [["desktop-light", { width: 1440, height: 900 }, "light"], ["phone-light", { width: 390, height: 844 }, "light"], ["desktop-dark", { width: 1440, height: 900 }, "dark"], ["phone-dark", { width: 390, height: 844 }, "dark"]]) {
    const phone = isPhone(viewport);
    const context = await browser.newContext({ viewport, colorScheme: scheme, isMobile: phone, hasTouch: phone });
    await context.addInitScript(FAKE_BROWSER);
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    await page.goto(ui.url);
    /** The phone keeps its list in a drawer: open it before looking at rows. */
    const sidebar = async () => { if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click(); };
    const row = (name) => page.locator(`[data-session-id="${name}"]`);
    await sidebar();
    await row(viewed).locator(".management-session-select").click();
    await page.locator("#composer").waitFor();
    const base = await page.title();

    // The worker asks from a kernel cell while the page shows the other session.
    assert.equal(prompts().length, 0);
    const turn = await host.session(worker).submit({ requestId: `global-${label}`, message: `CELL ${JSON.stringify({ code: CELL })}` });
    assert.equal(turn.accepted, true);
    await until(prompts, (list) => list.length === 1, `${label}: the worker's ask dialog`);
    await sidebar();
    await page.locator(`[data-session-id="${worker}"][data-asking="true"] [data-ask-mark="self"]`).waitFor();
    assert.equal(await row(viewed).getAttribute("data-asking"), null, `${label}: the session on screen is not marked`);
    await page.waitForFunction(() => new Promise((done) => setTimeout(() => requestAnimationFrame(() => done(true)), 500))); // the drawer slides in
    await shot(page, `ask-sidebar-mark-${label}`);

    // A folded group still says so.
    const header = page.locator('[data-group="local"] .management-group-header');
    assert.equal(await header.getAttribute("data-asking"), null, `${label}: an open group shows the row`);
    await header.click();
    await page.locator('[data-group="local"] .management-group-header[data-asking="true"]').waitFor();
    await shot(page, `ask-sidebar-group-${label}`);
    await header.click();
    await row(worker).waitFor();

    // Away: the title is marked and the worker's notification is raised, though nothing is asked of the session on screen.
    await setFront(page, false);
    await page.waitForFunction((value) => document.title !== value && document.title.endsWith(value), base);
    await page.waitForFunction(() => window.__notes.length === 1);
    assert.deepEqual(await page.evaluate(() => [window.__notes[0].tag, window.__notes[0].title]), [`prk-ask:${worker}`, "asker"], `${label}: one notification, for the worker`);

    // Its click selects the worker, whose own card waits there (the session on screen had none).
    await page.evaluate(() => window.__clickNote(0));
    await page.locator(".pi-ask").waitFor();
    await page.locator("#composer").waitFor();
    await shot(page, `ask-session-card-${label}`);
    await setFront(page, true);
    assert.equal(await page.title(), base, `${label}: back in front, the title is restored`);

    // Answered in the worker's session: the mark goes, the cell gets the answer, the title stays clean when away again.
    await page.locator('[data-ask-option="0"]').click();
    await page.locator('[data-action="ask-submit"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    assert.equal((await turn.completion).status, "completed");
    const result = host.session(worker).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /CELL_GOT<<User answers:\nstorage: SQLite>>/);
    await sidebar();
    await page.locator(`[data-session-id="${worker}"]:not([data-asking])`).waitFor();
    assert.equal(await page.locator("[data-ask-mark]").count(), 0, `${label}: no mark is left`);
    await setFront(page, false);
    await sleep(150);
    assert.equal(await page.title(), base, `${label}: nothing waits: no title mark even away`);
    assert.deepEqual(problems, [], `${label}: page errors`);
    await context.close();
    console.log(`PASS ${label}: another session's ask marks its row, the folded group and the title; the notification selects it; answered, everything clears`);
  }
});
