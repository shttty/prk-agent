import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { startWebDev } from "../../fixtures/web-dev.mjs";

export async function checkDerivedBrowser({ host, call, idle, get, until, a, root, onCleanup }) {
  let browser, web, ui;
  onCleanup(async () => { await browser?.close(); await ui?.close(); await web?.close(); });
  if (process.env.PI_TEST_DERIVED_BROWSER === "1") {
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    web = await startWebApplication({ socket: join(root, "gateway.sock"), host: "127.0.0.1", port: 0 });
    ui = await startWebDev(web.server.url);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/derived-session-browser");
    await mkdir(evidence, { recursive: true });
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => { errors.push(error.message); console.error("Browser runtime error:", error.message); });
    await page.goto(ui.url);
    await page.locator("#open-sidebar").click();
    const mainRow = page.locator(`[data-session-id="${a}"]`);
    await mainRow.waitFor({ state: "attached" });
    await page.locator("#create-session").click();
    const createDialog = page.locator('#management-dialog[data-kind="create"]');
    await createDialog.locator("#create-session-kernel").waitFor();
    await createDialog.locator("#create-session-label").fill("手机新建会话");
    await createDialog.locator("#confirm-create-session").click();
    await createDialog.waitFor({ state: "hidden" });
    const uiWorker = host.workbench().sessions.find((session) => session.label === "手机新建会话");
    assert.equal(uiWorker?.target, "local");
    assert.ok(host.state(uiWorker.name).kernel, "Every new session has a kernel execution binding");
    await page.locator("#open-sidebar").click();
    const visibleChildId = (await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Visible UI task", label: "派生验收子会话", lifecycle: "persistent", target: "local" }] })).children[0].sessionId;
    const visibleChild = get(visibleChildId).sessionId;
    await idle(visibleChild);
    await host.assignProject(visibleChild, { id: "project-main-derived", name: "主控协作项目" });
    await page.reload();
    await page.locator("#open-sidebar").click();
    await page.locator('#management-view-switch input[value="projects"] + label').click();
    const projectMainRow = page.locator(`[data-session-id="${a}"]`);
    const projectWorkerRow = page.locator(`[data-session-id="${visibleChild}"]`);
    await projectMainRow.waitFor({ state: "visible" });
    await projectWorkerRow.waitFor({ state: "visible" });
    const row = page.locator(`[data-session-id="${visibleChild}"]`);
    await row.waitFor({ state: "attached" }).catch(async (error) => {
      throw new Error(`Derived child was not listed: ${JSON.stringify({ errors, body: await page.locator("body").innerText() })}`, { cause: error });
    });
    await row.click();
    // Session actions live on the sidebar row; on a phone that row sits in the drawer.
    // The Mantine modal root has an empty box; wait on its content.
    const managementDialog = page.locator('#management-dialog[data-kind="derivation"] #upgrade-derived-session');
    const openManagement = async () => {
      if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
      await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
      await page.locator("#manage-derived-session").click();
      await managementDialog.waitFor();
    };
    await openManagement();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Mobile dialog does not overflow");
    await page.screenshot({ path: join(evidence, "phone-derived-session.png"), fullPage: true, animations: "disabled" });
    await page.locator("#upgrade-derived-session").click();
    await managementDialog.waitFor({ state: "hidden" });
    assert.equal(get(visibleChild).derivation.lifecycle, "user", "UI upgrade reaches Gateway");
    // The session menu archives; the confirmation shows the Gateway's cascade.
    if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
    await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
    await page.locator("#archive-session").click();
    const archiveDialog = page.locator('#management-dialog[data-kind="archive"]');
    await archiveDialog.locator(`[data-affected="${visibleChild}"]`).waitFor();
    await archiveDialog.locator("#confirm-archive").click();
    await until(() => !get(visibleChild) && host.workbench().archive.some((entry) => entry.group === visibleChild), "UI archives the child through Gateway");
    assert.deepEqual(errors, [], "No browser runtime errors");
    await browser.close(); browser = undefined;
    await ui.close(); ui = undefined;
    await web.close(); web = undefined;
  }
}
