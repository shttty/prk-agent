// A completed turn sends one lightweight snapshot, then the browser pulls the matching native history page.
import assert from "node:assert/strict";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { openSession, withRequestWorkbench } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ root, host, client, web, ui, page, provider, session, createSession, requests }) => {
  await prepareGatewayEnvironment(host, root, "fixture");
  const sessionId = await createSession("Operation snapshot");
  await openSession(page, ui.url, sessionId);
  const requestMark = requests.mark();
  provider.setResponses([fauxAssistantMessage("Only part.")]);
  const controller = new AbortController();
  const response = await fetch(new URL(`${session(sessionId)}/events`, web.server.url), { signal: controller.signal });
  const frames = [];
  const reading = (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const name = /^event: (.*)$/m.exec(frame)?.[1];
        const data = /^data: (.*)$/m.exec(frame)?.[1];
        if (name && data) frames.push({ name, value: JSON.parse(data) });
      }
    }
  })().catch(() => {});
  const until = async (predicate, label) => {
    for (const deadline = Date.now() + 20000; Date.now() < deadline; await new Promise((done) => setTimeout(done, 50))) if (predicate()) return;
    throw new Error(`Timed out: ${label}`);
  };
  await until(() => frames.some((frame) => frame.name === "snapshot"), "subscription snapshot");
  await client.request("send", { sessionId, requestId: "turn-1", message: "first" });
  await until(() => frames.filter((frame) => frame.name === "host" && frame.value.type === "operation_completed").length >= 1
    && frames.some((frame) => frame.name === "host" && frame.value.type === "snapshot" && frame.value.details.snapshot.state === "idle"), "operation snapshot");
  await page.waitForFunction(() => document.querySelector(".pi-message-user[data-entry-id]")?.textContent.includes("first"));
  assert.equal(requests.since(requestMark, "GET", `${session(sessionId)}/history-page`), 1);
  assert.equal(requests.since(requestMark, "GET", session(sessionId)), 0);
  controller.abort();
  await reading;
  const snapshots = frames.slice(1).filter((frame) => frame.name === "host" && frame.value.type === "snapshot");
  const messageEnds = frames.filter((frame) => frame.value.details?.sdkType === "message_end").length;
  console.log(`REQTRIM operation-snapshot ${JSON.stringify({ messageEnds, snapshots: snapshots.length })}`);
  assert.ok(messageEnds >= 2, "the turn ends a user and an assistant message");
  assert.equal(snapshots.length, 1, "one pushed snapshot per completed operation");
  const [pushed] = snapshots;
  const completedAt = frames.findIndex((frame) => frame.value.type === "operation_completed");
  assert.ok(frames.indexOf(pushed) > completedAt, "the snapshot follows operation_completed");
  const { snapshot } = pushed.value.details;
  assert.equal(snapshot.sequence, frames[completedAt].value.sequence);
  assert.equal(typeof snapshot.historyThrough, "string");
  assert(!Object.hasOwn(snapshot, "messages") && !Object.hasOwn(snapshot, "messageEntryIds"));
  console.log("PASS: one lightweight Gateway event; browser pulls and displays persisted entry IDs once");
});
