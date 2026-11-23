import assert from "node:assert/strict";

export async function checkBrowserModelFallback({ f, page, sessionId, device, click, shot }) {
  const banner = page.locator("#model-fallback-banner");
  await banner.waitFor();
  const snapshot = await f.state(sessionId), offset = f.provider.requests.length;
  assert.equal(snapshot.model, "sleepset/primary");
  assert.equal(snapshot.modelFallback.previousModel, "sleepset/removed");
  assert.equal(snapshot.modelFallback.model, snapshot.model);
  assert.equal(await banner.getAttribute("data-previous-model"), snapshot.modelFallback.previousModel);
  assert.equal(await banner.getAttribute("data-model"), snapshot.model);
  assert.equal(await banner.getAttribute("data-reason"), snapshot.modelFallback.reason);
  assert((await banner.getAttribute("class")).split(/\s/u).includes("shell-alert"));
  await page.waitForFunction(() => document.querySelector("#chat-model-select")?.dataset.settingValue === "sleepset/primary");
  assert.equal(await page.locator('[data-requires-reload="true"]').count(), 0, "Model fallback must not show an unrelated resource reload banner");
  assert.equal(snapshot.requiresReload, false, "No resource settings were changed before this screenshot");
  await shot("model-fallback");
  await page.locator("#composer").fill("SLEEPSET_BROWSER_DEFAULT_FALLBACK");
  const sent = page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === `/api/sessions/${sessionId}/send`);
  await click(page.locator("#send-message"));
  const admission = await (await sent).json();
  assert.equal(admission.accepted, true, "Authorized fallback permits sending without prior model selection");
  await f.until(() => f.host.state(sessionId).recentOperations?.some(({ operationId, status }) => operationId === admission.operationId && status === "completed"), "fallback browser send completes");
  assert.equal(f.provider.requests[offset].model, "primary", "First actual provider request uses the displayed PRK default");
  await page.locator('#composer[data-status="sleeping"]').waitFor();
  assert.deepEqual((await f.state(sessionId)).modelFallback, snapshot.modelFallback, "Notice survives a send and subsequent sleep");
  const native = page.waitForResponse((candidate) => candidate.request().method() === "POST"
    && new URL(candidate.url()).pathname === `/api/sessions/${sessionId}/native`
    && candidate.request().postDataJSON()?.action === (device === "desktop" ? "acknowledge-model-fallback" : "model"));
  if (device === "desktop") await click(page.locator("#acknowledge-model-fallback"));
  else {
    await click(page.locator("#select-available-model"));
    await click(page.locator('[data-model-option="sleepset/alternate"]'));
  }
  assert.equal((await (await native).json()).status, "completed");
  await banner.waitFor({ state: "detached" });
  const current = await f.state(sessionId);
  assert.equal(current.state, "sleeping", "Dismissal or model selection never wakes");
  assert.equal(Object.hasOwn(current, "modelFallback"), false);
  assert.equal(current.model, device === "desktop" ? "sleepset/primary" : "sleepset/alternate");
  assert.equal(f.provider.requests.length, offset + 1);
  await shot("model-fallback-dismissed");
  await page.reload();
  await page.locator("#composer").waitFor();
  await page.waitForFunction((expected) => document.querySelector("#chat-model-select")?.dataset.settingValue === expected, current.model);
  assert.equal(await banner.count(), 0, "Reload receives authoritative notice absence, not a stale local banner");
}
