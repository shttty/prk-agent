import assert from "node:assert/strict";

export async function recoverFromBrowser(ctx, page, sessionId) {
  await ctx.selectSession(page, sessionId);
  const history = await ctx.browserJson(page, `/api/sessions/${encodeURIComponent(sessionId)}/history`);
  assert.equal(history.readOnly, true, "Gateway restart history must be explicitly read-only.");
  const reconnectResponse = page.waitForResponse((response) => response.url().includes(`/api/sessions/${encodeURIComponent(sessionId)}/recover`) && response.request().method() === "POST");
  await page.locator("#recover-kernel").click();
  const response = await reconnectResponse;
  assert.equal(response.status(), 200);
  const recovered = await response.json();
  assert.equal(recovered.session.recovery.status, "new", "Nothing is adopted after a Gateway loss: recovery starts a new runtime");
  await ctx.selectSession(page, sessionId);
  return {
    sessionId: recovered.snapshot.sessionId,
    kernelId: recovered.snapshot.kernel?.kernelId,
    historyReadOnly: true,
    recoveryStatus: recovered.session.recovery.status,
  };
}
