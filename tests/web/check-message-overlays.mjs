// Message overlays (check:quick): a message mounts its Menu / Tooltip / RerunDialog only once it is used. Opening a
// session mounts none; the menu (keyboard), the rerun dialog and the copy feedback still open, close and return focus.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { installRenderCounter, readMountedComponents } from "../fixtures/workspace-mock/render-counter.mjs";

const OVERLAYS = ["@mantine/core/Menu", "@mantine/core/Popover", "@mantine/core/Tooltip", "@mantine/core/Modal"];
const now = Date.now();
const messages = [];
for (let index = 0; index < 6; index++) {
  messages.push({ role: "user", content: [{ type: "text", text: `question ${index}` }], timestamp: now - 60000 + index * 2000 });
  messages.push({ role: "assistant", content: [{ type: "text", text: `answer ${index}` }], timestamp: now - 59000 + index * 2000, stopReason: "stop" });
}
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const calls = [];
  const { context, page, problems } = await openMockWorkbench(browser, server.url, {
    snapshots,
    beforeGoto: installRenderCounter,
    routes: {
      "/api/sessions/w1/native": (body) => {
        calls.push({ kind: "native", action: body.action, args: body.args });
        return { requestId: body.requestId, action: body.action, status: "completed", message: "ok", data: {} };
      },
      "/api/sessions/w1/send": (body) => {
        calls.push({ kind: "send", message: body.message });
        return { accepted: true, operationId: "op-retry" };
      },
    },
  });
  await selectSession(page, "w1");
  const rows = page.locator(".pi-message[data-message-id]");
  await rows.nth(messages.length - 1).waitFor();
  assert.deepEqual(await readMountedComponents(page, OVERLAYS), {}, "untouched messages mount no overlay components");

  const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.messageId));
  const [user, reply] = [ids[ids.length - 2], ids[ids.length - 1]];
  const inMessage = (id, selector) => page.locator(`.pi-message[data-message-id="${id}"] ${selector}`);
  const focusedAction = () => page.evaluate(() => document.activeElement?.dataset?.action ?? null);

  // Message menu from the keyboard: Enter opens it, Escape closes it and focus goes back to its button.
  await inMessage(reply, '[data-action="message-menu"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem").first().waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("menuitem").first().waitFor({ state: "hidden" });
  assert.equal(await focusedAction(), "message-menu", "closing the menu returns focus to its button");
  // Its item still quotes the message into the composer.
  await inMessage(reply, '[data-action="message-menu"]').click();
  await page.getByRole("menuitem").first().click();
  assert.match(await page.locator("#composer").inputValue(), /^> answer 5/, "the menu item quotes the message");

  // Rerun dialog opens on first use and returns focus to the button that opened it.
  await inMessage(user, '[data-action="edit-message"]').click();
  await page.locator('.pi-rerun-dialog [data-action="cancel"]').click();
  await page.locator(".pi-rerun-dialog").waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.dataset?.action === "edit-message");

  // Copy feedback still shows on the copied message.
  await inMessage(user, '[data-action="copy-message"]').click();
  await inMessage(user, '[data-copy-feedback="message"]').waitFor();

  // Refresh retry backs up and resends directly without opening RerunDialog.
  await inMessage(user, '[data-action="retry-message"]').click();
  await page.waitForFunction(() => !document.querySelector(".pi-rerun-dialog"));
  assert.equal(await page.locator(".pi-rerun-dialog").count(), 0, "retry-message never opens RerunDialog");
  await page.waitForTimeout(50);
  assert.deepEqual(calls.filter((entry) => entry.kind === "send" || entry.action === "tree"), [
    { kind: "native", action: "tree", args: { entryId: "e10" } },
    { kind: "send", message: "question 5" },
  ]);

  const mounted = Object.keys(await readMountedComponents(page, OVERLAYS));
  assert.deepEqual(mounted.sort(), [`message:${reply}`, `message:${user}`].sort(), "only the used messages mounted overlays");
  assert.deepEqual(problems, [], "page errors");
  await context.close();
  console.log("PASS message overlays: none mounted on open; menu, rerun dialog and copy feedback mount on use");
} finally {
  await browser.close();
  await server.close();
}
