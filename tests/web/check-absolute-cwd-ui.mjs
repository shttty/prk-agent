#!/usr/bin/env node
import { stringify } from "smol-toml";
// Working directories are absolute end to end, through the real Web → Gateway → owned target daemon path. The
// three directory pickers (new session, move session, instance form) browse and write absolute paths from the current
// cwd, "上一级" climbs freely (the target root is "/", no server root above the cwd), the inputs show absolute paths,
// an instance cwd cannot be saved relative, and moving a session writes the picked absolute directory.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { createSessionHistory } from "../../src/sessions/history/assemble-history.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const playwrightPath = process.env.PI_TEST_PLAYWRIGHT;
const chromiumPath = process.env.PI_TEST_CHROMIUM;
if (!playwrightPath || !chromiumPath) throw new Error("Set PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM to run the absolute cwd browser check.");
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)).href);
const webHost = process.env.PI_TEST_WEB_HOST ?? "127.0.0.1";

await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-absolute-cwd-ui-"));
  const parent = join(tempRoot, "root"); // an ordinary directory above the instance cwd
  const project = join(parent, "proj");
  const sub = join(project, "sub");
  const deep = join(sub, "deep");
  const other = join(project, "other");
  await mkdir(deep, { recursive: true });
  await mkdir(other, { recursive: true });
  const historyDir = join(root, "history");

  const instances = { instances: [{ id: "local", label: "Local instance", tags: [], ...config, cwd: project }] };
  const configPath = join(root, "config.toml");
  await writeFile(configPath, stringify({ session: { workerTools: "direct" } }));
  await writeFile(join(root, "instances.toml"), stringify(instances), { mode: 0o600 });
  const history = await createSessionHistory({ cwd: root, directory: historyDir });
  const movableId = history.create("local", "可移动会话", project).getSessionId();
  // An absolute cwd whose directory has since disappeared: the move dialog starts there and must still let you climb out.
  const goneCwdId = history.create("local", "目录已删除会话", join(project, "gone")).getSessionId();

  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "absolute-cwd-ui", models: [{ id: "controlled" }], tokensPerSecond: 5000 });
  runtime.registerNativeProvider(provider.provider);
  const host = await createGatewayHost({ cwd: root, home: root, historyDir, config: parsePrkConfig({ session: { workerTools: "direct" } }, instances), model: "absolute-cwd-ui/controlled" }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "low", cwd: root, agentDir: root },
  });
  const socket = join(root, "gateway.sock");
  const gateway = await startGateway(host, socket);
  const web = await startWebApplication({ socket, host: webHost, port: 0 });
  const ui = await startWebDev(web.server.url, { host: webHost });
  let browser;
  onCleanup(async () => {
    await browser?.close().catch(() => {});
    await ui.close().catch(() => {});
    await web.close().catch(() => {});
    await gateway.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await prepareGatewayEnvironment(host, root, "local");

  const workerOf = (name) => host.workbench().sessions.find((worker) => worker.sessionId === name);
  const until = async (check, label, timeout = 20_000) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await check()) return;
      assert.ok(Date.now() < deadline, `timed out: ${label}`);
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 100));
    }
  };

  browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ui.url);
  const dialog = page.locator("#management-dialog");
  const pickerPath = (scope) => scope.locator("#directory-picker .management-directory-path");
  const pickerAt = (scope, absolute) => until(async () => (await pickerPath(scope).getAttribute("data-path")) === absolute, `picker shows ${absolute}`);
  const back = (scope) => scope.locator('#directory-picker [data-action="directory-back"]').click();
  /** Enter a folder of the picker (its entry carries the absolute path); the shown path follows. */
  const enter = async (scope, absolute) => {
    await scope.locator(`#directory-picker [data-action="directory-open"][data-path=${JSON.stringify(absolute)}]`).click();
    await pickerAt(scope, absolute);
  };
  const select = async (scope) => {
    await scope.locator('#directory-picker [data-action="directory-select"]').click();
    await scope.locator("#directory-picker").waitFor({ state: "hidden" });
  };

  // 1. Moving a session: the picker starts at its cwd and writes the picked directory as an absolute path.
  const movable = page.locator(`[data-session-id="${movableId}"] .management-session-select`);
  await movable.waitFor();
  await movable.click();
  await page.locator(`[data-session-id="${movableId}"] .management-session-menu`).click();
  await page.locator("#retarget-session").click();
  const retarget = page.locator('#management-dialog[data-kind="retarget"]');
  await until(async () => (await retarget.locator("#retarget-cwd").inputValue()) === project, "the move dialog starts from the session's absolute cwd");
  await retarget.locator("#browse-retarget-directory").click();
  await pickerAt(retarget, project);
  assert.equal(await pickerPath(retarget).getAttribute("data-at-root"), "false");
  // Up from the instance cwd reaches its parent, which is not a root: the target root is "/" and the way up stays open.
  await retarget.locator('#directory-picker [data-action="directory-up"]').click();
  await pickerAt(retarget, parent);
  assert.equal(await pickerPath(retarget).getAttribute("data-at-root"), "false");
  assert.equal(await retarget.locator('#directory-picker [data-action="directory-up"]').isEnabled(), true, "nothing stops the climb above the instance cwd");
  await enter(retarget, project);
  await enter(retarget, sub);
  await enter(retarget, deep);
  await select(retarget);
  assert.equal(await retarget.locator("#retarget-cwd").inputValue(), deep);
  await retarget.locator("#confirm-retarget").click();
  await dialog.waitFor({ state: "hidden" });
  await until(() => workerOf(movableId).cwd === deep, "the moved session stores the absolute cwd");
  await page.locator("#toggle-workspace").click();
  await page.locator("#toggle-tree").click();
  await page.locator("#files-panel .pi-files-crumbs").waitFor();
  await until(async () => (await page.locator("#files-panel .pi-files-crumbs").getAttribute("data-abs-path")) === deep, "the file tree breadcrumb shows the absolute cwd");

  // 1b. A session whose absolute cwd no longer exists: the picker reports it, "上一级" climbs to a directory that does.
  await page.locator(`[data-session-id="${goneCwdId}"] .management-session-select`).click();
  await page.locator(`[data-session-id="${goneCwdId}"] .management-session-menu`).click();
  await page.locator("#retarget-session").click();
  const gone = page.locator('#management-dialog[data-kind="retarget"]');
  await until(async () => (await gone.locator("#retarget-cwd").inputValue()) === join(project, "gone"), "the move dialog starts from the session's own absolute cwd");
  await gone.locator("#browse-retarget-directory").click();
  await pickerAt(gone, join(project, "gone"));
  await until(async () => (await gone.locator('#directory-picker [role="alert"]').count()) === 1, "the picker reports the missing directory");
  assert.equal(await gone.locator('#directory-picker [data-action="directory-select"]').isDisabled(), true);
  await gone.locator('#directory-picker [data-action="directory-up"]').click();
  await pickerAt(gone, project);
  await select(gone);
  assert.equal(await gone.locator("#retarget-cwd").inputValue(), project);
  await page.locator("#close-management-dialog").click();
  await dialog.waitFor({ state: "hidden" });

  // 2. New session: starts from the instance cwd and writes the absolute path.
  await page.locator('button[data-action="create-session"][data-target="local"]').click();
  const create = page.locator('#management-dialog[data-kind="create"]');
  await until(async () => (await create.locator("#create-session-cwd").inputValue()) === project, "new sessions default to the instance's absolute cwd");
  await create.locator("#browse-session-directory").click();
  await pickerAt(create, project);
  await enter(create, other);
  await select(create);
  assert.equal(await create.locator("#create-session-cwd").inputValue(), other);
  const created = page.waitForResponse((response) => response.url().endsWith("/api/sessions") && response.request().method() === "POST");
  await create.locator("#confirm-create-session").click();
  const response = await created;
  assert.equal(response.request().postDataJSON().cwd, other);
  assert.equal((await response.json()).session.cwd, other);
  await dialog.waitFor({ state: "hidden" });

  // 3. Instance form: browse after testing the connection, with or without an absolute cwd; saving still requires one.
  await page.locator("#manage-targets").click();
  const settings = page.locator("#settings-targets");
  await page.locator('[data-action="edit-target"][data-target="local"]').click();
  assert.equal(await page.locator("#target-cwd").inputValue(), project);
  assert.equal(await settings.locator("#browse-target-directory").isDisabled(), true, "an absolute cwd does not bypass the connection test");
  assert.equal(await settings.locator("#browse-target-python").isDisabled(), true, "the Python picker uses the same connection gate");
  await settings.locator("#inspect-target").click();
  await settings.locator('#target-inspection[data-state="success"]').waitFor();
  await page.locator("#browse-target-directory").click();
  await pickerAt(settings, project);
  await enter(settings, sub);
  await select(settings);
  assert.equal(await page.locator("#target-cwd").inputValue(), sub);
  const targetWrites = [];
  page.on("request", (request) => { if (request.url().includes("/api/targets") && ["PATCH", "POST"].includes(request.method()) && !request.url().endsWith("/browse") && !request.url().endsWith("/inspect")) targetWrites.push(request.url()); });
  await page.locator("#target-cwd").fill("proj/sub");
  await settings.locator("#browse-target-directory").click();
  await pickerAt(settings, dirname(config.python));
  await back(settings);
  await page.locator("#save-target").click();
  await page.locator("#target-editor-error").waitFor();
  assert.deepEqual(targetWrites, [], "a relative instance cwd is refused before anything is sent");
  await page.locator("#target-cwd").fill(sub);
  const saved = page.waitForResponse((candidate) => candidate.url().includes("/api/targets/local") && candidate.request().method() === "PATCH");
  await page.locator("#save-target").click();
  assert.equal((await saved).status(), 200);
  assert.equal(host.getTarget("local").cwd, sub, "the instance now holds the absolute cwd");

  await page.locator("#add-target").click();
  assert.equal(await page.locator("#target-cwd").inputValue(), "", "a new instance's cwd is empty, not '.'");
  await page.locator("#target-local").check({ force: true });
  await settings.locator("#inspect-target").click();
  await settings.locator('#target-inspection[data-state="success"]').waitFor();
  await settings.locator("#browse-target-directory").click();
  await pickerAt(settings, "/");
  await back(settings);
  // An absolute cwd that does not exist remains the start path: the picker reports the error.
  await page.locator("#target-cwd").fill(join(project, "missing"));
  await page.locator("#browse-target-directory").click();
  await until(async () => (await settings.locator('#directory-picker [role="alert"]').count()) === 1, "the picker reports the unreadable directory");
  assert.equal(await settings.locator('#directory-picker [data-action="directory-select"]').isDisabled(), true);
  await back(settings);
  await page.locator("#target-cwd").fill(project);
  await page.locator("#browse-target-directory").click();
  await pickerAt(settings, project);
  await enter(settings, other);
  await select(settings);
  assert.equal(await page.locator("#target-cwd").inputValue(), other);
  await settings.locator("#browse-target-python").click();
  await settings.locator('#directory-picker[data-mode="file"]').waitFor();
  await pickerAt(settings, other);
  await back(settings);
  await page.keyboard.press("Escape");

  assert.deepEqual(errors, [], "no page errors");
  console.log("PASS absolute cwd UI: pickers browse and write absolute paths for new session, move session and instance form; up climbs above the cwd; inputs show absolute paths; relative instance cwd refused; breadcrumb shows the absolute cwd");
});
