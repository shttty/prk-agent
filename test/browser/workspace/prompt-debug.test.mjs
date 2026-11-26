import assert from "node:assert/strict";
import test from "node:test";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";
import { createPromptCapture } from "../../../src/sessions/prompt-capture/create-prompt-capture.ts";

const model = { provider: "relay", id: "relay", api: "openai-completions" };
const tool = { name: "probe", description: "Probe it.", parameters: { type: "object", properties: {} } };

/** The report the Gateway would answer after two requests whose earlier message changed between them. */
function unstableReport(id) {
  const capture = createPromptCapture();
  const ask = (messages) => {
    capture.observeContext([{ role: "system", content: "Base.", sections: { a: "<a>one</a>" }, timestamp: 0 }]);
    capture.observeRequest({ model: "m", messages: [{ role: "system", content: "Base.\n\n<a>one</a>" }, ...messages], tools: [{ type: "function", function: tool }] }, model);
  };
  ask([{ role: "user", content: "hello" }, { role: "assistant", content: "hint: alpha" }, { role: "user", content: "next" }]);
  ask([{ role: "user", content: "hello" }, { role: "assistant", content: "hint: bravo" }, { role: "user", content: "next" }, { role: "assistant", content: "done" }]);
  return { sessionId: id, ...capture.report() };
}

test("debug mode gates the debug tools menu; the prompt panel lists sections and tools and points at the first changed message", async (t) => {
  const endpoint = await startCompletionsEndpoint(t);
  const f = await browserFixture(t, { endpoint, config: { session: { workerTools: "code" } } });
  const id = await f.create();
  for (const message of ["First question", "Second question"]) assert.equal((await f.complete(id, await f.send(id, message))).status, "completed");
  await f.open(id);
  const toggle = f.page.locator("#toggle-workspace");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await f.page.locator("#new-terminal").waitFor();
  assert.equal(await f.page.locator('[data-action="debug-tools"]').count(), 0, "debug mode is off by default");

  await f.page.locator("#open-settings").click();
  await f.page.locator('label.pi-settings-title[for="setting-debug-mode"]').click();
  assert.equal(await f.page.locator("#setting-debug-mode").isChecked(), true);
  await f.page.locator("#close-settings").click();
  await f.page.locator('[data-action="debug-tools"]').click();
  await f.page.locator('[data-action="open-debug-tool"][data-tool="prompt"]').click();

  const panel = f.page.locator('[data-panel="prompt"][data-status="ok"]');
  await panel.waitFor();
  const kernel = panel.locator('[data-section-key="kernel"]');
  await kernel.locator("button").click();
  assert.match(await kernel.locator("pre").innerText(), /^<kernel>/);
  await panel.locator('[data-tool-name="kernel_code"]').waitFor();
  assert.equal(await panel.locator('[data-field="messages"] [data-prefix-stable="true"]').count(), 1);
  assert.equal(await panel.locator("[data-first-change]").count(), 0);

  await f.page.route(`**/api/sessions/${id}/prompt`, (route) => route.fulfill({ json: unstableReport(id) }));
  await panel.locator('[data-action="reload-prompt"]').click();
  const messages = panel.locator('[data-field="messages"] [data-prefix-stable="false"]');
  await messages.waitFor();
  assert.equal(await messages.getAttribute("data-first-change"), "1");
  assert.match(await messages.locator('[data-side="before"] pre').innerText(), /alpha/);
  assert.match(await messages.locator('[data-side="after"] pre').innerText(), /bravo/);
  assert.equal(await panel.locator('[data-tool-name="probe"]').count(), 1);

  await f.page.locator("#open-settings").click();
  await f.page.locator('label.pi-settings-title[for="setting-debug-mode"]').click();
  await f.page.locator("#close-settings").click();
  await f.page.locator('[data-action="debug-tools"]').waitFor({ state: "detached" });
  await f.page.locator('[data-panel="prompt"]').waitFor({ state: "detached" });
});
