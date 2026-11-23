/** Run Python in the currently selected session and read the real output. */
// A Gateway with no configured instance still owns the decision: the web adapter reports it and offers nothing to create.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { startWebDev } from "../../fixtures/web-dev.mjs";

export async function checkCreationAndInstanceEdit(ctx) {
Object.defineProperties(ctx, {
    createSession: { configurable: true, get: () => createSession },
    selectSessionOn: { configurable: true, get: () => selectSessionOn },
    selectSession: { configurable: true, get: () => selectSession },
    sessionAction: { configurable: true, get: () => sessionAction },
    visibleText: { configurable: true, get: () => visibleText },
    liveOutput: { configurable: true, get: () => liveOutput },
    noOverflow: { configurable: true, get: () => noOverflow },
    assertNoSession: { configurable: true, get: () => assertNoSession },
    configuredInstanceGroups: { configurable: true, get: () => configuredInstanceGroups },
    runHere: { configurable: true, get: () => runHere },
    manageButton: { configurable: true, get: () => manageButton },
    beforeInspection: { configurable: true, get: () => beforeInspection },
    inspectionButton: { configurable: true, get: () => inspectionButton },
    inspectionFeedback: { configurable: true, get: () => inspectionFeedback },
    directoryPicker: { configurable: true, get: () => directoryPicker },
});

const createSession = async (target, key = target, { label, cwd = "session-one" } = {}) => {
    const modal = await ctx.openCreation(target);
    assert.equal(await modal.locator("#create-session-kernel").count(), 0, "Creation offers no kernelspec choice: the interpreter is the instance's");
    if (label !== undefined) await modal.locator("#create-session-label").fill(label);
    // `cwd` names the directory below the instance cwd the picker selects; the session gets its absolute path.
    const absoluteCwd = cwd ? join(ctx.workbenchTempRoot, cwd) : ctx.workbenchTempRoot;
    if (cwd) {
      const browse = ctx.page.waitForResponse((result) => result.url() === `${ctx.ui.url}/api/targets/browse` && result.request().method() === "POST");
      await modal.locator("#browse-session-directory").click();
      await browse;
      assert.equal(await modal.locator(".management-directory-path").getAttribute("data-path"), ctx.workbenchTempRoot, "The picker opens in the instance cwd, shown absolute");
      await modal.locator(`#directory-picker [data-action="directory-open"][data-path=${JSON.stringify(absoluteCwd)}]`).click();
      await ctx.wait(async () => (await modal.locator(".management-directory-path").getAttribute("data-path")) === absoluteCwd, "picker shows the chosen directory absolute");
      await modal.locator('#directory-picker [data-action="directory-select"]').click();
    }
    assert.equal(await modal.locator("#create-session-cwd").inputValue(), absoluteCwd, "The cwd input shows the absolute path");
    const [response] = await Promise.all([
      ctx.page.waitForResponse((result) => result.url() === `${ctx.ui.url}/api/sessions` && result.request().method() === "POST"),
      modal.locator("#confirm-create-session").click(),
    ]);
    assert.equal(response.status(), 201);
    const expected = { target, cwd: absoluteCwd, ...(label?.trim() ? { label: label.trim() } : {}) };
    assert.deepEqual(response.request().postDataJSON(), expected);
    const { session: created, snapshot: createdSnapshot } = await response.json();
    assert.equal(created.target, target);
    assert.equal(created.cwd, absoluteCwd);
    if (label?.trim()) assert.equal(created.label, label.trim());
    assert.notEqual(created.sessionId, target, "Creation returns a native session ID, not the instance ID");
    assert.equal(created.sessionId, createdSnapshot.sessionId, "Creation registers the SDK snapshot identity");
    ctx.names.set(key, created.sessionId);
    await ctx.connected(created.sessionId);
    return created;
  };

const selectSessionOn = async (currentPage, key) => {
    if (await currentPage.locator("#open-sidebar").isVisible() && await currentPage.locator("#open-sidebar").getAttribute("aria-expanded") !== "true") await currentPage.locator("#open-sidebar").click();
    const row = currentPage.locator(`.management-session-row[data-session-id="${ctx.names.get(key)}"]`);
    await row.click();
    await ctx.connectedOn(currentPage, ctx.names.get(key));
  };

const selectSession = async (key) => selectSessionOn(ctx.page, key);

const sessionAction = async (id) => {
    // Session actions live in the selected sidebar row's own menu.
    const trigger = ctx.page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]');
    if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
    await ctx.page.locator(`#${id}`).click();
  };

const visibleText = async (needle, currentPage = ctx.page) => {
    const output = currentPage.locator("#messages .tool-call .output-block").filter({ hasText: needle }).last();
    await output.waitFor({ state: "attached" });
    // Completed turns fold their tool rows behind the turn summary; open outer disclosures first.
    for (const disclosure of await output.locator("xpath=ancestor::details").all()) {
      if (!await disclosure.evaluate((node) => node.open)) await disclosure.locator(":scope > summary").click();
    }
    await output.waitFor({ state: "visible" });
  };

const liveOutput = async (needle) => {
    await ctx.page.waitForFunction((value) => [...document.querySelectorAll("#messages .tool-call.is-running .output-block")].some((node) => node.textContent.includes(value)), needle);
    await visibleText(needle);
  };

const noOverflow = async (currentPage) => assert(await currentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal viewport overflow");

const assertNoSession = async () => {
    for (const selector of ["#chat-view", "#composer", "#archive-session", "#cancel-operation"]) {
      assert.equal(await ctx.page.locator(selector).isVisible(), false, `${selector} must be hidden without a selected worker`);
    }
  };

const groupsWith = (currentPage, selector) => currentPage.locator(".management-group").filter({ has: currentPage.locator(selector) });

const configuredInstanceGroups = (currentPage = ctx.page) => groupsWith(currentPage, 'button[data-action="create-session"][data-target="alpha"]');

const runHere = async (key, code, needle) => {
    const before = ctx.snapshot(key).recentOperations.at(-1)?.operationId;
    await ctx.send(code);
    // While the message starts the session's runtime the host serves the stored snapshot, which has no recentOperations yet.
    await ctx.wait(() => ctx.snapshot(key).recentOperations?.at(-1)?.operationId && ctx.snapshot(key).recentOperations.at(-1).operationId !== before && !ctx.snapshot(key).operation, `${key}: ${needle}`);
    const completion = ctx.snapshot(key).recentOperations.at(-1);
    assert.equal(completion.status, "completed", `${key}: ${needle} completed`);
    await visibleText(needle);
  };

const emptyRoot = join(ctx.root, "no-targets");

const emptyHistory = join(ctx.root, "empty-history");

await mkdir(emptyRoot, { mode: 0o700 });

await mkdir(emptyHistory, { mode: 0o700 });

ctx.emptyHost = await createGatewayHost({ cwd: ctx.root, home: emptyRoot, historyDir: emptyHistory, model: "web-browser-controlled/controlled", targets: [] }, { runtimeDependencies: ctx.runtimeDependencies });

ctx.emptyEndpoint = await startGateway(ctx.emptyHost, join(emptyRoot, "gateway.sock"));

ctx.emptyApplication = await startWebApplication({ socket: join(emptyRoot, "gateway.sock"), port: 0 });

ctx.emptyUi = await startWebDev(ctx.emptyApplication.server.url);

await ctx.page.goto(ctx.emptyUi.url);

await ctx.page.locator("#add-target-empty").waitFor();

await assertNoSession();

await noOverflow(ctx.page);

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-no-targets.png"), fullPage: true, animations: "disabled" });

await ctx.emptyUi.close();

ctx.emptyUi = undefined;

await ctx.emptyApplication.close();

ctx.emptyApplication = undefined;

await ctx.emptyEndpoint.close();

ctx.emptyEndpoint = undefined;

ctx.emptyHost = undefined;

await ctx.page.goto(ctx.ui.url);

const manageButton = ctx.page.locator("#manage-targets");

await manageButton.click();

await ctx.page.locator("#add-target").click();

assert.equal(await ctx.page.locator("#target-ssh-command").isVisible(), true, "A new instance starts as a remote one asking for its connection command");

const manualLabel = ctx.page.locator("#target-label");

await manualLabel.fill("手工实例");

const inspectionGate = Promise.withResolvers();

await ctx.page.route("**/api/targets/inspect", async (route) => { await inspectionGate.promise; await route.continue(); }, { times: 1 });

const beforeInspection = await ctx.ids();

await ctx.page.locator("#target-local").check({ force: true });

await ctx.page.locator("#target-ssh-command").waitFor({ state: "hidden" });

const inspectionButton = ctx.page.locator("#inspect-target");

const inspectionFeedback = ctx.page.locator("#target-inspection-feedback");

const inspectionResponse = ctx.page.waitForResponse((response) => response.url().endsWith("/api/targets/inspect") && response.request().method() === "POST");

const inspection = inspectionButton.click();

await inspectionFeedback.waitFor({ state: "visible" });

await manualLabel.fill("用户已编辑实例");

inspectionGate.resolve();

await inspection;

const inspected = await (await inspectionResponse).json();

assert.equal(typeof inspected.hostname, "string");

assert(inspected.hostname.length > 0 && !inspected.hostname.includes("."));

assert(inspected.pythonCandidates.every((path) => typeof path === "string" && path.startsWith("/")), "Python candidates are absolute target paths");

assert.equal(await manualLabel.inputValue(), "用户已编辑实例", "Late inspection hostname cannot overwrite a label edited by the user");

await ctx.wait(async () => (await inspectionFeedback.getAttribute("data-state")) === "success", "connection inspection success feedback");

assert.equal(await ctx.page.locator("#browse-target-directory").isEnabled(), true, "A successful connection test enables browsing without a cwd");

await ctx.page.locator("#target-cwd").fill(ctx.workbenchTempRoot);

assert.deepEqual(await ctx.ids(), beforeInspection, "connection verification must not create a kernel");

const browseForPicker = ctx.page.waitForResponse((response) => response.url().endsWith("/api/targets/browse") && response.request().method() === "POST");

await ctx.page.locator("#browse-target-directory").click();

await browseForPicker;

const directoryPicker = ctx.page.locator("#directory-picker");

}
