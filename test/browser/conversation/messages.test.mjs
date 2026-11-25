import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

const idle = "#composer-form:not([data-busy])";
const send = "#send-message";
const input = "#composer";

test("send, observe streamed output, stop, then retry and edit from the original message", async (t) => {
  let calls = 0;
  const f = await browserFixture(t, { config: { session: { workerTools: "direct", idleTimeoutMs: 1_500 } }, rate: 40, answer() {
    calls++;
    return fauxAssistantMessage(calls === 1 ? "Streaming verification ".repeat(300) : "Ready again");
  } });
  const id = await f.create();
  await until(async () => (await f.request("state", { sessionId: id })).state === "sleeping", "sleep before browsing");
  let wakeRequests = 0;
  const wakePath = `**/api/sessions/${id}/wake`;
  const wakeGate = Promise.withResolvers();
  await f.page.route(wakePath, async (route) => {
    wakeRequests++;
    await wakeGate.promise;
    await route.continue();
  });
  await f.open(id);
  const composer = f.page.locator(input);
  try {
    await f.page.locator(`${input}[data-status="sleeping"]`).waitFor();
    assert.equal(wakeRequests, 0, "viewing a sleeping session must not wake it");
    await composer.focus();
    await until(() => wakeRequests === 1, "composer focus posts wake");
    await composer.blur();
    await composer.focus();
    await composer.fill("/");
    const commands = f.page.locator("#native-candidate-list");
    await commands.getByText("/compact", { exact: true }).waitFor();
    assert.equal(await commands.getByText("/reload", { exact: true }).count(), 0);
    await composer.fill("Original question");
    wakeGate.resolve();
    await f.page.locator(`${input}[data-status="idle"]`).waitFor();
    assert.equal(await composer.inputValue(), "Original question", "wake keeps the typed draft");
    await composer.blur();
    await composer.focus();
    assert.equal(wakeRequests, 1, "repeated focus or typing must not duplicate wake");
  } finally { wakeGate.resolve(); }
  await f.page.locator(send).click();
  await f.page.locator('#operation-state[data-stage="output"]').waitFor();
  await f.page.locator("#messages").getByText(/Streaming verification/).first().waitFor();
  await f.page.locator("#cancel-operation").click();
  await f.page.locator(idle).waitFor();
  await f.page.locator('.pi-operation-outcome[data-status="cancelled"]').waitFor();
  const user = f.page.locator('.pi-message-user[data-entry-id]').filter({ hasText: "Original question" });
  await user.hover();
  await user.locator('[data-action="retry-message"]').click();
  await f.page.locator("#messages").getByText("Ready again").waitFor();
  await f.page.locator(idle).waitFor();
  assert.equal(calls, 2);
  await user.hover();
  await user.locator('[data-action="edit-message"]').click();
  await f.page.locator('.pi-rerun-dialog [data-action="current"]').click();
  await f.page.waitForFunction(() => document.querySelector("#composer").value === "Original question");
  await f.page.locator(input).fill("Revised question");
  await f.page.locator(send).click();
  await f.page.locator('.pi-message-user[data-entry-id]').filter({ hasText: "Revised question" }).waitFor();
  await f.page.locator(idle).waitFor();
  await until(() => calls === 3, "edited prompt reached faux provider");
  assert.equal(text(f.state(id).messages.findLast((item) => item.role === "user")), "Revised question");
});

test("send an image with no text and see it in the real conversation", async (t) => {
  let received;
  const f = await browserFixture(t, { answer(context) { received = context.messages.at(-1); } });
  const id = await f.create();
  await f.open(id);
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==", "base64");
  await f.page.locator('input[type="file"][accept*="image"]').setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: pixel });
  assert.equal(await f.page.locator(input).inputValue(), "");
  const response = f.page.waitForResponse((res) => res.request().method() === "POST" && new URL(res.url()).pathname === `/api/sessions/${id}/send`);
  await f.page.locator(send).click();
  const receipt = await (await response).json();
  assert.equal(receipt.accepted, true, JSON.stringify(receipt));
  await until(() => received, "provider input");
  assert.equal(text(received), "");
  assert.equal(received.content.find((item) => item.type === "image")?.data, pixel.toString("base64"));
  await f.page.locator("#messages .pi-message-user .pi-message-attachment").waitFor();
});

test("sidebar shows a non-selected session starting and settling without changing the visible chat", async (t) => {
  const release = Promise.withResolvers();
  const f = await browserFixture(t, { answer: async (context) => {
    if (text(context.messages.at(-1)) === "Background request") await release.promise;
    return fauxAssistantMessage("Background done");
  } });
  const active = await f.create("Selected"), background = await f.create("Background");
  try {
    await f.open(active);
    const row = f.page.locator(`[data-session-id="${background}"]`);
    const pill = (state) => row.locator(`.management-session-state[data-state="${state}"]`);
    await pill("idle").waitFor();
    const receipt = await f.send(background, "Background request");
    assert(receipt.accepted);
    await pill("running").waitFor();
    assert.equal(await f.page.locator(idle).count(), 1);
    release.resolve();
    await pill("idle").waitFor();
    assert.equal((await f.complete(background, receipt)).status, "completed");
    await f.page.locator("#messages").getByText("Background done").waitFor({ state: "detached" });
    assert(new URL(f.page.url()).hash.includes(active));
  } finally { release.resolve(); }
});
