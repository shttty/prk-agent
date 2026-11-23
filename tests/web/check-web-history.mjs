import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { HISTORY_DIAGNOSTIC_CHILD_ENV, captureOriginalHistoryDiagnostics } from "./history/capture-original-diagnostics.mjs";
import { checkArchiveTree } from "./history/check-archive-tree.mjs";
import { checkRestartAndPurge } from "./history/check-restart-and-purge.mjs";


const CLOSED_WORKER = () => document.querySelector("#composer")?.getAttribute("data-status") === "closed";

const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/history-browser");
await mkdir(evidence, { recursive: true });
const runOriginalHistory = async () => {
  await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-history-"));
  const socket = join(root, "gateway.sock");
  const stack = {};
  let ui, browser;
  onCleanup(async () => {
    const errors = [];
    for (const close of [() => stack.gateway?.close(), () => browser?.close(), () => ui?.close(), () => stack.web?.close()]) {
      try { await close(); } catch (error) { errors.push(error); }
    }
    await rm(root, { recursive: true, force: true });
    if (errors.length) throw new AggregateError(errors, "History browser cleanup failed");
  });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "web-history", models: [{ id: "controlled" }], tokensPerSecond: 5000 });
  modelRuntime.registerNativeProvider(faux.provider);
  let calls = 0;
  faux.setResponses(Array.from({ length: 10 }, () => async (context) => {
    calls += 1;
    return context.messages.at(-1)?.role === "toolResult"
      ? fauxAssistantMessage("HISTORY_RESULT_41 — saved conversation")
      : fauxAssistantMessage(fauxToolCall("kernel_code", { code: "history_value = 41\nprint(history_value)" }), { stopReason: "toolUse" });
  }));
  const options = { cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct" }, targetCacheRoot: join(root, "target-cache") }), model: "web-history/controlled", targets: parseTargets([{ id: "history-target", label: "History instance", tags: [], ...config, cwd: root }]) };
  const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "low", cwd: root, agentDir: root } };
  stack.host = await createGatewayHost(options, dependencies);
  const host = stack.host;
  await prepareGatewayEnvironment(host, root, "history-target");
  stack.gateway = await startGateway(host, socket);
  stack.web = await startWebApplication({ socket, host: process.env.PI_TEST_WEB_HOST ?? "127.0.0.1", port: 0 });
  ui = await startWebDev(stack.web.server.url, { host: process.env.PI_TEST_WEB_HOST ?? "127.0.0.1" });
  const a = await host.createSession({ target: "history-target" });
  const b = await host.createSession({ target: "history-target" });
  await host.renameSession(a.session.sessionId, "Saved history title");
  const operation = await host.session(a.session.sessionId).submit({ requestId: "history-browser-seed", message: "Run the controlled history fixture." });
  assert.equal(operation.accepted, true);
  assert.equal((await operation.completion).status, "completed");
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(15_000);
  const select = async (view, name) => {
    if (await view.locator("#open-sidebar").isVisible()) await view.locator("#open-sidebar").click();
    const row = view.locator(`[data-session-id="${name}"]`);
    await row.click();
    // Selecting closes the phone drawer; session actions live on the sidebar row, so reopen it.
    if (await view.locator("#open-sidebar").isVisible()) await view.locator("#open-sidebar").click();
    await view.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
    await view.locator("#session-details").click();
    await view.waitForFunction((id) => document.querySelector("#session-id")?.textContent?.includes(id), stack.host.workbench().sessions.find((worker) => worker.sessionId === name).sessionId);
    await view.locator("#close-session-details").click();
    await view.locator("#session-id").waitFor({ state: "hidden" });
    // Leave the phone as selection left it: drawer closed.
    const drawer = view.getByRole("dialog");
    if (await drawer.isVisible()) { await view.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" }); }
  };
  const details = async (view) => {
    // Session actions sit on the selected sidebar row.
    const row = view.locator('[data-session-id][aria-current="true"]');
    const trigger = row.locator('[data-action="session-menu"]');
    if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  };
  const noOverflow = async (view) => assert(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const url = ui.url;
  await page.goto(url);
  await select(page, a.session.sessionId);
  await page.waitForFunction(() => document.querySelector("#messages")?.textContent.includes("HISTORY_RESULT_41 — saved conversation"));
  await details(page);
  assert(!(await page.locator("#archive-session").isDisabled()), "Active sessions can be archived");
  await page.keyboard.press("Escape");
  await page.locator("#composer").fill("draft A preserved");
  await select(page, b.session.sessionId);
  await page.locator("#composer").fill("draft B preserved");
  await select(page, a.session.sessionId);
  assert.equal(await page.locator("#composer").inputValue(), "draft A preserved");
  await details(page);
  await page.locator("#archive-session").click();
  await page.locator('#management-dialog[data-kind="archive"] #confirm-archive').click();
  // The row, not any element of that session: the monitor card carries the same data-session-id until the archive lands.
  await page.locator(`.management-session-row[data-session-id="${a.session.sessionId}"]`).waitFor({ state: "hidden" });
  assert(host.workbench().archive.some((group) => group.group === a.session.sessionId), "Archiving retains a history group");
  await page.locator("#open-settings").click();
  await page.locator("#open-archive").click();
  await page.locator(`#settings-archive [data-archive-group="${a.session.sessionId}"] [data-action="unarchive"]`).click();
  await page.locator('#settings-archive [data-state="empty"]').waitFor();
  assert(host.history(a.session.sessionId).snapshot.messages.length > 0, "History is readable after unarchive");
  await page.keyboard.press("Escape");
  await select(page, b.session.sessionId);
  assert.equal(await page.locator("#composer").inputValue(), "draft B preserved");
  await select(page, a.session.sessionId);
  await page.waitForFunction(CLOSED_WORKER);
  await page.locator("#composer").fill("draft A preserved");
  assert(!(await page.locator("#send-message").isDisabled()), "A closed worker stays sendable; the next message brings a kernel back");

  await page.locator("#composer").fill("Resume after archive");
  await page.locator("#send-message").click();
  await page.waitForFunction(() => document.querySelector('#composer')?.getAttribute('data-status') === 'idle');
  assert(host.history(a.session.sessionId).snapshot.messages.length > 0);
  await host.archiveSession(a.session.sessionId, { confirm: true });
  await host.unarchive(a.session.sessionId);
  await select(page, a.session.sessionId);
  await page.waitForFunction(CLOSED_WORKER);
  await page.locator("#composer").fill("draft A preserved");
  await checkArchiveTree({ host, faux, page, noOverflow, evidence });
  await checkRestartAndPurge({ stack, options, dependencies, config, root, socket, url, page, browser, errors, evidence, select, details, noOverflow, a, b, calls: () => calls });
  console.log(`PASS browser history: restart read-only desktop+390px, confirmed archiving and purge, recovery failure remains read-only, isolated drafts. Evidence: ${evidence}`);
  });
};
if (process.env[HISTORY_DIAGNOSTIC_CHILD_ENV] === "1") await runOriginalHistory();
else await captureOriginalHistoryDiagnostics(import.meta.url);
