// Real Chromium + Vite, mocked Gateway (UI mechanism only; the real connection/version checks are the S6 acceptance):
// a pending instance shows its 待补 mark and opens its settings; the editor keeps the typed connection command verbatim,
// shows a late connection-test reply only for the draft it was asked for, words a refused version (check or save) by
// `details.reason`, browses the target for the interpreter in file mode, and saves command + interpreter as typed.
// A pending instance can still take a new session (saved without a runtime); no kernelspec is asked for. Opening that
// sleeping session only reads it: no wake request.
import assert from "node:assert/strict";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { SNAPSHOTS, snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";

const evidence = process.env.PI_TEST_EVIDENCE_DIR;
const COMMAND = "SSHPASS=fixture-secret sshpass -e ssh -T -oBatchMode=yes -oStrictHostKeyChecking=yes -oConnectTimeout=10 -oServerAliveInterval=15 analyst@office-gpu-workstation.internal.example";
const OLD = { id: "alpha", label: "Alpha", local: false, tags: [], cwd: "/data" };
const targets = [{ id: "alpha", label: "Alpha", local: false, tags: [], configurationIssue: { code: "SSH_COMMAND_REQUIRED", message: "Configure an unattended target shell command." } }];
const PYTHONS = { "/usr/bin/python3.8": null, "/opt/py312/bin/python3": "3.12.1" };
const TOO_OLD = { error: "Python 3.9 or newer is required.", code: "INVALID_REQUEST", details: { reason: "python-version", version: "3.8.20" } };
const fulfill = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const phone of [false, true]) {
    const tag = phone ? "phone" : "desktop";
    const inspected = [];
    const browsed = [];
    const saved = [];
    const created = [];
    let hold = null;
    const wakes = [];
    const { context, page, problems } = await openMockWorkbench(browser, server.url, {
      targets,
      // The created session's own stream serves a sleeping snapshot, as the Gateway does.
      snapshots: { ...SNAPSHOTS, n1: snapshotOf("n1", "sleeping") },
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      mobile: phone,
      routes: {
        "/api/sessions": (body) => {
          created.push(body);
          return { session: { sessionId: "n1", label: "new", state: "sleeping", target: "alpha", cwd: "/data", configurationIssue: targets[0].configurationIssue }, snapshot: snapshotOf("n1", "sleeping") };
        },
      },
      beforeGoto: async (current) => {
        current.on("request", (request) => { if (request.method() === "POST" && /\/api\/sessions\/[^/]+\/wake$/.test(new URL(request.url()).pathname)) wakes.push(request.url()); });
        // Saving a complete changed configuration is version-checked by the Gateway itself.
        await current.route("**/api/targets/alpha", (route) => {
          const target = route.request().postDataJSON()?.target;
          if (!target) return fulfill(route, 200, { target: OLD });
          if (PYTHONS[target.python] === null) return fulfill(route, 400, TOO_OLD);
          saved.push(target);
          // The Gateway answers an instance edit with the whole workbench (instance changes have no collection event).
          return fulfill(route, 200, { targets: [{ id: "alpha", label: "Alpha", local: false, tags: [], python: target.python }], sessions: [], archive: [] });
        });
        await current.route("**/api/targets/inspect", async (route) => {
          const { connection } = route.request().postDataJSON();
          inspected.push(connection);
          if (hold && connection.python === undefined) await hold.promise;
          if (connection.python === undefined) return fulfill(route, 200, { hostname: `host-${inspected.length}`, platform: "linux", home: "/home/analyst", pythonCandidates: Object.keys(PYTHONS) });
          const version = PYTHONS[connection.python];
          return version ? fulfill(route, 200, { hostname: "host", platform: "linux", home: "/home/analyst", pythonCandidates: [], python: { path: connection.python, version } }) : fulfill(route, 400, TOO_OLD);
        });
        await current.route("**/api/targets/browse", (route) => {
          const body = route.request().postDataJSON();
          browsed.push(body);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ path: body.path, atRoot: false, truncated: false, entries: [{ name: "lib", type: "directory", path: `${body.path}/lib` }, { name: "python3", type: "file", path: `${body.path}/python3` }] }) });
        });
      },
    });
    try {
      // A session on the pending instance is created (history only, no runtime) with just the instance and cwd.
      if (phone) await page.locator("#open-sidebar").click();
      await page.locator('button[data-action="create-session"][data-target="alpha"]').click();
      const create = page.locator('#management-dialog[data-kind="create"]');
      await create.locator('[data-configuration-issue="SSH_COMMAND_REQUIRED"]').waitFor();
      assert.equal(await create.locator("#create-session-kernel").count(), 0, `${tag}: no kernelspec choice`);
      await create.locator("#confirm-create-session").click();
      await until(() => created.length === 1, "the creation POST");
      assert.deepEqual(created[0], { target: "alpha", cwd: "/data" });
      await create.waitFor({ state: "hidden" });
      // The new session is selected and its sleeping snapshot arrives; selecting must not wake it.
      await page.waitForFunction(() => document.querySelector("#composer")?.getAttribute("data-status") === "sleeping");
      await page.waitForTimeout(300);
      assert.deepEqual(wakes, [], `${tag}: selecting a sleeping session sends no wake`);

      // The pending mark sits on the instance group and opens the instance's settings.
      if (phone && await page.locator("#open-sidebar").getAttribute("aria-expanded") !== "true") await page.locator("#open-sidebar").click();
      const mark = page.locator('.management-group [data-configuration-issue="SSH_COMMAND_REQUIRED"]');
      await mark.click();
      const dialog = page.locator("#instance-settings-dialog");
      await dialog.locator('[data-configuration-issue="SSH_COMMAND_REQUIRED"]').waitFor();
      const command = dialog.locator("#target-ssh-command");
      assert.equal(await command.inputValue(), "", `${tag}: the pending instance has no connection command`);
      await command.fill(COMMAND);
      if (evidence) await page.screenshot({ path: join(evidence, `${tag}-editor-long-command.png`), animations: "disabled" });
      // D1: the interpreter is chosen only after this connection passed its test.
      assert.equal(await dialog.locator("#browse-target-python").isDisabled(), true, `${tag}: no Python browsing before the connection test`);
      assert.equal(await dialog.locator("#target-python").getAttribute("data-connected"), "false");

      // A reply to an older draft never shows against the edited one.
      hold = Promise.withResolvers();
      await dialog.locator("#inspect-target").click();
      await dialog.locator('#target-inspection-feedback[data-state="pending"]').waitFor();
      await command.fill(`${COMMAND} -p 2222`);
      assert.equal(await dialog.locator("#target-inspection-feedback").count(), 0, `${tag}: the edit drops the pending test`);
      hold.resolve();
      await page.waitForTimeout(200);
      assert.equal(await dialog.locator("#target-inspection").getAttribute("data-state"), "idle", `${tag}: the late reply is ignored`);
      hold = null;
      await command.fill(COMMAND);
      await dialog.locator("#inspect-target").click();
      await dialog.locator('#target-inspection-feedback[data-state="success"]').waitFor();
      assert.deepEqual(inspected.at(-1), { local: false, sshCommand: COMMAND }, `${tag}: the draft goes as typed, no python, cwd or target name`);

      // A too old interpreter is told by its reason, in the check and again when the Gateway refuses the save.
      await dialog.locator('[data-action="use-python-candidate"][data-path="/usr/bin/python3.8"]').click();
      const check = dialog.locator("#target-python-check");
      await dialog.locator('#target-python-check[data-state="error"]').waitFor();
      assert.equal(await check.getAttribute("data-reason"), "python-version");
      assert.deepEqual(inspected.at(-1), { local: false, sshCommand: COMMAND, python: "/usr/bin/python3.8" });
      await dialog.locator("#save-target").click();
      await dialog.locator('#target-editor-error[data-code="INVALID_REQUEST"][data-reason="python-version"]').waitFor();
      assert.equal(saved.length, 0, `${tag}: the refused interpreter is not saved`);
      if (evidence) await page.screenshot({ path: join(evidence, `${tag}-editor-python-too-old.png`), animations: "disabled" });

      // Browsing for the interpreter: file mode, starting beside the typed one; picking a file checks it.
      await dialog.locator("#target-python").fill("/opt/py312/bin/python");
      await dialog.locator("#browse-target-python").click();
      await dialog.locator('#directory-picker[data-mode="file"]').waitFor();
      assert.deepEqual(browsed.at(-1), { connection: { local: false, sshCommand: COMMAND }, path: "/opt/py312/bin" });
      assert.equal(await dialog.locator('#directory-picker [data-action="directory-select"]').count(), 0, `${tag}: file mode selects files only`);
      await dialog.locator('#directory-picker [data-action="file-select"][data-path="/opt/py312/bin/python3"]').click();
      await dialog.locator('#target-python-check[data-state="success"][data-version="3.12.1"]').waitFor();
      assert.equal(await dialog.locator("#target-python").inputValue(), "/opt/py312/bin/python3");
      if (evidence) await page.screenshot({ path: join(evidence, `${tag}-editor-python-checked.png`), animations: "disabled" });
      await dialog.locator("#save-target").click();
      await dialog.locator("#target-label").waitFor({ state: "detached" });
      await until(() => saved.length === 1, "the PATCH");
      assert.deepEqual(saved[0], { id: "alpha", label: "Alpha", tags: [], local: false, cwd: "/data", sshCommand: COMMAND, python: "/opt/py312/bin/python3" }, `${tag}: the command is saved verbatim with the selected explicit interpreter`);
      // The returned workbench is applied: the instance is no longer pending (the phone sidebar shows it when opened).
      if (phone && await page.locator("#open-sidebar").getAttribute("aria-expanded") !== "true") await page.locator("#open-sidebar").click();
      await page.waitForFunction(() => document.querySelector('.management-group[data-group="alpha"]') && !document.querySelector('.management-group [data-configuration-issue]'), null, { timeout: 5000 });

      assert.deepEqual(problems, [], `${tag}: no page errors`);
      console.log(`PASS target editor ${tag}: pending mark, verbatim command, stale test ignored, version reason, file picker, save, pending create`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}

async function until(check, label, timeout = 5000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await new Promise((done) => setTimeout(done, 20));
  }
}
