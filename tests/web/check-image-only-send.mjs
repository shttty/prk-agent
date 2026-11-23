import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { openSession, withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
await withRequestWorkbench(async ({ root, host, ui, page, provider, session, createSession, errors }) => {
  await prepareGatewayEnvironment(host, root, "fixture");
  provider.setResponses([(context) => {
    const user = context.messages.findLast((message) => message.role === "user");
    assert(user.content.some((part) => part.type === "image" && part.mimeType === "image/png" && part.data === png));
    assert(!user.content.some((part) => part.type === "text" && part.text.trim()));
    return fauxAssistantMessage("IMAGE_REACHED_PROVIDER");
  }]);
  const id = await createSession("Image-only input");
  await openSession(page, ui.url, id);
  const composer = page.locator("#composer");
  const send = page.locator("#send-message");
  assert(await send.isDisabled());
  await composer.focus();
  await composer.evaluate((node, data) => {
    const clipboardData = new DataTransfer();
    const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
    clipboardData.items.add(new File([bytes], "pixel.png", { type: "image/png" }));
    node.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, png);
  await page.waitForFunction(() => !document.querySelector("#send-message")?.disabled);
  assert.equal(await composer.inputValue(), "");
  const admission = page.waitForResponse((response) => response.url().endsWith(`${session(id)}/send`));
  await composer.press("Enter");
  const result = await (await admission).json();
  assert.equal(result.accepted, true, JSON.stringify(result));
  await page.locator("#messages .pi-message-user img").waitFor({ state: "visible" });
  await page.getByText("IMAGE_REACHED_PROVIDER", { exact: true }).waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  console.log("PASS pasted image without text: Enter, Gateway admission, SDK image in transcript and controlled provider payload");
});
