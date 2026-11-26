import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyMessageImageViewer } from "./verify-message-image-viewer.mjs";
import { chartPng } from "./chart-png.mjs";
import { verifyFoldedKernelImages } from "./verify-folded-kernel-images.mjs";

const idle = "#composer-form:not([data-busy])";
const send = "#send-message";
const input = "#composer";

export async function verifyConversationImages(t) {
  let received;
  const replying = Promise.withResolvers();
  const external = "https://image.invalid/tracker.png";
  const f = await browserFixture(t, { async answer(context) {
    const last = context.messages.at(-1);
    if (received || last?.role !== "user" || !last.content.some(({ type }) => type === "image")) return fauxAssistantMessage("Cell completed.");
    received = last;
    await replying.promise;
    return fauxAssistantMessage(`![Target chart](./reply%20chart.png)\n\n![External chart](${external})\n\n![Missing chart](./missing.png)`);
  } });
  try {
    await verifyImages(f, () => received, replying, external);
  } finally { replying.resolve(); }
}

async function verifyImages(f, provided, replying, external) {
  const id = await f.create();
  await f.open(id);
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==", "base64");
  await writeFile(join(f.cwd, "reply chart.png"), await chartPng(f.page));
  const externalRequests = [];
  f.page.on("request", (request) => { if (request.url() === external) externalRequests.push(request.url()); });
  await f.page.locator('input[type="file"][accept*="image"]').setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: pixel });
  assert.equal(await f.page.locator(input).inputValue(), "");
  const response = f.page.waitForResponse((res) => res.request().method() === "POST" && new URL(res.url()).pathname === `/api/sessions/${id}/send`);
  await f.page.locator(send).click();
  const receipt = await (await response).json();
  assert.equal(receipt.accepted, true, JSON.stringify(receipt));
  const received = await until(provided, "provider input");
  assert.equal(text(received), "");
  assert.equal(received.content.find((item) => item.type === "image")?.data, pixel.toString("base64"));
  // The live SDK user message already carries the image while the reply is still pending.
  const image = f.page.locator("#messages .pi-message-user .pi-message-attachment img");
  await image.waitFor();
  await f.page.locator("#composer-form[data-busy]").waitFor();
  if (process.env.PI_TEST_WEB_EVIDENCE) await f.page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/user-image-live.png`, animations: "disabled" });
  replying.resolve();
  const reply = f.page.locator('#messages .pi-message-assistant img[alt="Target chart"]');
  await reply.waitFor();
  await f.page.waitForFunction(() => document.querySelector('img[alt="Target chart"]')?.naturalWidth === 400);
  assert.equal(await reply.getAttribute("loading"), "lazy");
  await f.page.locator(`#messages a[href="${external}"]`).waitFor();
  assert.deepEqual(externalRequests, []);
  await f.page.locator('[data-image-status="error"]').filter({ hasText: "./missing.png" }).waitFor();
  if (process.env.PI_TEST_WEB_EVIDENCE) await f.page.screenshot({ path: `${process.env.PI_TEST_WEB_EVIDENCE}/reply-markdown.png`, animations: "disabled" });
  await verifyMessageImageViewer(f.page, image);
  await f.page.reload();
  await reply.waitFor();
  assert.equal(await image.count(), 1, "history keeps exactly one user thumbnail");
  assert.equal(await f.page.locator("#messages .pi-message-user [data-attachment-badge]").count(), 0, "images show no file badge");
  await f.page.locator("#open-settings").click();
  await f.page.locator("#open-visual-effects").click();
  await f.page.locator('label.pi-settings-title[for="setting-show-message-images"]').click();
  await f.page.locator("#close-settings").click();
  await image.waitFor({ state: "detached" });
  await reply.waitFor({ state: "detached" });
  await f.page.locator("#messages .pi-message-user [data-attachment-badge]").waitFor();
  await f.page.locator(idle).waitFor();
  await f.page.locator(input).fill("/settings showImages=on");
  await f.page.locator(send).click();
  await image.waitFor();
  await f.page.locator("#open-settings").click();
  await f.page.locator("#open-visual-effects").click();
  assert.equal(await f.page.locator("#setting-show-message-images").isChecked(), true);
  await f.page.locator("#close-settings").click();
  await verifyFoldedKernelImages(f, id);
}
