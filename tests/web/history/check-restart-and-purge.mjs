import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { parseTargets } from "../target-instances/parse-targets.mjs";
import { recoverFromMenu } from "./recover-from-menu.mjs";

const CLOSED_WORKER = () => document.querySelector("#composer")?.getAttribute("data-status") === "closed";

/**
 * Second half of the browser history check: the Gateway owner restarts with its instance unreachable, history stays
 * readable without model calls, recovery fails visibly, and archiving/purging only touch the archived session.
 * `stack` holds the live host/gateway/web (replaced here, closed by the caller's cleanup).
 */
export async function checkRestartAndPurge({ stack, options, dependencies, config, root, socket, url, page, browser, errors, evidence, select, details, noOverflow, a, b, calls }) {
  const providerCalls = calls();
  // Restart the Gateway owner, not just the API adapter. The page stays on the same UI origin, and the API comes back
  // on its own port behind the proxy, to verify client draft namespacing survives the server restart too.
  const port = Number(new URL(stack.web.server.url).port);
  await stack.web.close();
  await stack.gateway.close();
  // The same instance, now reached through a connection command that exits at once: the target is unreachable.
  const unavailableOptions = { ...options, targets: parseTargets([{ id: "history-target", label: "History instance", tags: [], ...config, local: false, sshCommand: "exit 255", cwd: root }]) };
  stack.host = await createGatewayHost(unavailableOptions, dependencies);
  stack.gateway = await startGateway(stack.host, socket);
  stack.web = await startWebApplication({ socket, host: process.env.PI_TEST_WEB_HOST ?? "127.0.0.1", port });
  const host = stack.host;
  await page.reload();
  await page.waitForFunction(CLOSED_WORKER);
  await page.waitForFunction(() => document.querySelector("#messages")?.textContent.includes("HISTORY_RESULT_41 — saved conversation"));
  const restored = host.workbench().sessions.find(({ sessionId }) => sessionId === a.session.sessionId);
  assert.equal(await page.locator("#composer").inputValue(), "draft A preserved");
  assert.equal(calls(), providerCalls);
  await noOverflow(page);
  await page.screenshot({ path: join(evidence, "desktop-read-only-history.png"), fullPage: true, animations: "disabled" });

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(url);
  await select(phone, a.session.sessionId);
  await phone.waitForFunction(() => document.querySelector("#messages")?.textContent.includes("HISTORY_RESULT_41 — saved conversation"));
  await phone.waitForFunction(CLOSED_WORKER);
  await phone.waitForFunction(() => document.querySelector("#open-sidebar")?.getAttribute("aria-expanded") === "false");
  await noOverflow(phone);
  await phone.screenshot({ path: join(evidence, "phone-read-only-history.png"), fullPage: true, animations: "disabled" });
  // The target is unreachable: recovery cannot start a new runtime there, and says so.
  const recoveryStarted = performance.now();
  await recoverFromMenu(phone);
  await phone.locator('#connection-banner[data-kind="recovery"][data-stage="kernel"][data-code="TARGET_UNREACHABLE"]').waitFor({ state: "visible" });
  assert(performance.now() - recoveryStarted < 5000, "Unreachable-target recovery banner appears within five seconds");
  assert.equal(host.workbench().sessions.find(({ sessionId }) => sessionId === a.session.sessionId).state, "unavailable", "A failed recovery leaves the worker unavailable (no runtime, reason kept), not a failed session");
  await phone.locator('.topbar-status[data-status="unavailable"]').waitFor();
  await noOverflow(phone);
  await phone.screenshot({ path: join(evidence, "phone-new-kernel-failed.png"), fullPage: true, animations: "disabled" });
  await details(page);
  await page.locator("#archive-session").click();
  await page.locator('#management-dialog[data-kind="archive"] [data-action="cancel"]').click();
  assert(host.history(a.session.sessionId), "Cancelled archiving preserves history");
  await details(page);
  const draftKey = (id) => `${new URL(url).origin}/api:sessions-v1:session:${encodeURIComponent(id)}`;
  const aDraftKey = draftKey(a.session.sessionId);
  const bDraftKey = draftKey(b.session.sessionId);
  assert.equal(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || "null")?.draft, aDraftKey), "draft A preserved", "The archived session has a draft to remove");
  await page.locator("#archive-session").click();
  await page.locator('#management-dialog[data-kind="archive"]').locator(`[data-affected="${a.session.sessionId}"]`).waitFor();
  await page.locator('#management-dialog[data-kind="archive"] #confirm-archive').click();
  await page.waitForFunction((name) => !document.querySelector(`[data-session-id="${name}"]`), a.session.sessionId);
  const browserState = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
  assert.equal(Object.hasOwn(browserState, aDraftKey), false, "Only archived session state is removed");
  assert.equal(JSON.parse(browserState[bDraftKey]).draft, "draft B preserved", "Sibling draft remains");
  await select(page, b.session.sessionId);
  assert.equal(await page.locator("#composer").inputValue(), "draft B preserved");
  // Purging from the archive is the only path that removes the SDK files.
  await page.locator("#open-settings").click();
  await page.locator("#open-archive").click();
  const archive = page.locator("#settings-archive");
  await archive.locator(`[data-archive-group="${a.session.sessionId}"] [data-action="purge-archive"]`).click();
  assert(host.workbench().archive.some((group) => group.group === a.session.sessionId), "Preparing purge does not delete history");
  await archive.locator('[data-action="cancel"]').click();
  assert(host.workbench().archive.some((group) => group.group === a.session.sessionId), "Cancelling purge retains the group");
  await archive.locator(`[data-archive-group="${a.session.sessionId}"] [data-action="purge-archive"]`).click();
  await archive.locator('[data-action="confirm-purge-archive"]').click();
  await archive.locator('[data-state="empty"]').waitFor();
  assert.throws(() => host.history(a.session.sessionId), /not managed/, "Permanent purge deletes SDK history");
  await page.keyboard.press("Escape");
  await noOverflow(page);
  await page.screenshot({ path: join(evidence, "desktop-history-deleted.png"), fullPage: true, animations: "disabled" });
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, "history-evidence.json"), JSON.stringify({ sessionId: restored.sessionId, title: restored.label, target: restored.target, providerCallsBeforeBrowse: providerCalls, providerCallsAfterBrowse: calls(), viewports: [1280, 390], pageErrors: errors }, null, 2));
}
