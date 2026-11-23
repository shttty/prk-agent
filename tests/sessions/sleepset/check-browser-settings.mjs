import assert from "node:assert/strict";

export async function checkBrowserSleepingSettings({ f, page, sessionId, click, shot }) {
  await f.until(() => f.host.state(sessionId).state === "idle", "selection completes its existing automatic wake");
  await page.locator('#composer[data-status="sleeping"]').waitFor();
  await f.until(async () => (await f.kernels()).length === 0, "sleep completes kernel disposal before the no-allocation baseline");
  const initial = await f.state(sessionId), offset = f.provider.requests.length, kernels = await f.kernels();
  assert.equal(initial.state, "sleeping");
  for (const id of ["chat-model-select", "chat-thinking-select", "chat-tool-mode"]) assert.equal(await page.locator(`#${id}`).isEnabled(), true, `${id} is usable asleep`);
  const choose = async (id, selector, action, args, value) => {
    await click(page.locator(`#${id}`));
    const reply = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/sessions/${sessionId}/native` && response.request().postDataJSON()?.action === action);
    await click(page.locator(selector));
    const response = await reply;
    assert.deepEqual(response.request().postDataJSON().args, args);
    assert.equal((await response.json()).status, "completed");
    await page.waitForFunction(({ id, value }) => document.getElementById(id)?.dataset.settingValue === value, { id, value });
    assert.equal((await f.state(sessionId)).state, "sleeping");
  };
  await choose("chat-model-select", '[data-model-option="sleepset/alternate"]', "model", { model: "sleepset/alternate" }, "sleepset/alternate");
  await choose("chat-thinking-select", '[data-thinking-option="high"]', "thinking", { level: "high" }, "high");
  await choose("chat-tool-mode", '[data-tool-mode="direct"]', "tool-mode", { mode: "direct" }, "direct");
  assert.equal((await f.state(sessionId)).streamId, initial.streamId);
  assert.equal(f.provider.requests.length, offset, "Browser sleeping edits make no provider request");
  assert.deepEqual(await f.kernels(), kernels, "Browser sleeping edits allocate no kernel");
  await page.mouse.move(0, 0);
  await shot("sleeping-settings");
  await page.locator("#composer").fill("SLEEPSET_BROWSER_WAKE");
  const sent = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${sessionId}/send`);
  await click(page.locator("#send-message"));
  const admission = await (await sent).json();
  assert.equal(admission.accepted, true);
  await f.until(() => f.host.state(sessionId).recentOperations?.some(({ operationId, status }) => operationId === admission.operationId && status === "completed"), "browser send completes through real SDK");
  const payload = f.provider.requests[offset];
  assert.equal(payload.model, "alternate");
  assert.equal(payload.reasoning?.effort, "high");
  assert(payload.tools.some(({ name }) => name === "session_spawn"), "Browser direct selection reaches first provider payload");
  await page.locator('#composer[data-status="sleeping"]').waitFor();
  await f.change(sessionId, "model", { model: "sleepset/primary" });
  await f.change(sessionId, "thinking", { level: "low" });
  await f.change(sessionId, "tool-mode", { mode: "code" });
  await page.waitForFunction(() => document.querySelector("#chat-model-select")?.dataset.settingValue === "sleepset/primary"
    && document.querySelector("#chat-thinking-select")?.dataset.settingValue === "low" && document.querySelector("#chat-tool-mode")?.dataset.settingValue === "code");
  assert.equal((await f.state(sessionId)).state, "sleeping", "External native settings push values without waking");
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#chat-model-select")?.dataset.settingValue === "sleepset/primary"
    && document.querySelector("#chat-thinking-select")?.dataset.settingValue === "low" && document.querySelector("#chat-tool-mode")?.dataset.settingValue === "code");
  assert.equal(f.provider.requests.length, offset + 1, "Reload reads the server snapshot, not a cached optimistic selection");
}
