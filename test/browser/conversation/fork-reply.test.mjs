import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";

test("fork button opens a new conversation while the source is running", async (t) => {
  const release = Promise.withResolvers();
  const f = await browserFixture(t, { async answer(context) {
    const prompt = text(context.messages.at(-1));
    if (prompt === "Hold source") await release.promise;
    return fauxAssistantMessage(`Reply to ${prompt}`);
  } });
  const id = await f.create();
  await f.complete(id, await f.send(id, "Saved prompt"));
  try {
    const running = await f.send(id, "Hold source");
    await f.open(id);
    await f.page.locator("#composer-form[data-busy]").waitFor();
    const message = f.page.locator("#messages .pi-message-assistant[data-message-id]").filter({ hasText: "Reply to Saved prompt" });
    await message.hover();
    const button = message.locator('[data-action="fork-message"]');
    assert.equal(await button.isEnabled(), true);
    const response = f.page.waitForResponse((res) => res.request().method() === "POST" && new URL(res.url()).pathname.endsWith("/native") && res.request().postDataJSON()?.action === "fork-reply");
    await button.click();
    const result = await (await response).json();
    assert.equal(result.status, "completed", JSON.stringify(result));
    await f.page.waitForURL((url) => url.hash.includes(result.data.session.sessionId));
    await message.waitFor();
    assert.equal(f.state(id).operation.operationId, running.operationId);
    release.resolve();
    assert.equal((await f.complete(id, running)).status, "completed");
  } finally { release.resolve(); }
});
