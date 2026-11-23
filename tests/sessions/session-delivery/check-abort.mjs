import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkAbort(fixture) {
  const { root, host, owner, spawn, snapshot, start, call, idle, nativeId, text, until } = fixture;
  const target = await spawn("Abort recipient");
  const sibling = await spawn("Unprivileged sender");
  const seed = await call(target, "kernel_code", { code: "delivery_sentinel = 73129" });
  assert(!seed.result.isError, text(seed.result));
  const kernelId = snapshot(target).kernel.kernelId;
  const marker = join(root, "abort-cell-ready");
  const run = await start(target, `TOOL ${JSON.stringify({ tool: "kernel_code", args: {
    code: `import time\nfrom pathlib import Path\ndelivery_cell_count = globals().get('delivery_cell_count', 0) + 1\nPath(${JSON.stringify(marker)}).write_text('ready')\ntry:\n    time.sleep(60)\nexcept KeyboardInterrupt:\n    time.sleep(1)\n    raise\nprint('UNREACHABLE_LONG_CELL_COMPLETION')`,
  } })}`);
  await until(async () => { try { return await readFile(marker, "utf8") === "ready"; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }, "real long kernel cell ready");
  const denied = await call(sibling, "session_send", { to: nativeId(target), message: "UNAUTHORIZED_ABORT", delivery: "abort" });
  assert.equal(denied.result.isError, true);
  assert.match(text(denied.result), /control authority/i);
  assert.equal(snapshot(target).operation.operationId, run.admission.operationId);
  assert.equal(snapshot(target).state, "running", "unauthorized abort has no cancellation side effect");
  assert(!snapshot(target).messages.slice(run.offset).some((message) => parsePeerMessages(text(message))?.some(({ body }) => body === "UNAUTHORIZED_ABORT")));

  // An older steer remains in the project inbox while a later followUp is owned by Pi.
  const steer = await call(owner, "session_send", { to: nativeId(target), message: "BEFORE_ABORT_STEER" });
  const follow = await call(owner, "session_send", { to: nativeId(target), message: "BEFORE_ABORT_FOLLOWUP", delivery: "followUp" });
  assert(!steer.result.isError && !follow.result.isError);
  await until(() => snapshot(target).queuedMessages.followUp.length > 0, "followUp accepted by native SDK");
  let settled = false;
  void run.completion.then(() => { settled = true; });
  let concurrent;
  const watcher = host.session(target).subscribe((event) => {
    if (event.type === "operation_cancel_requested" && !concurrent) {
      concurrent = call(sibling, "session_send", { to: nativeId(target), message: "ARRIVED_DURING_ABORT" });
    }
  });
  const abort = await call(owner, "session_send", { to: nativeId(target), message: "AUTHORIZED_ABORT", delivery: "abort" });
  assert(!abort.result.isError, text(abort.result));
  assert.equal(abort.value.accepted, true);
  assert.equal(settled, false, "sender acceptance does not await SDK.abort()/the interrupting cell's delayed cleanup");
  assert(concurrent, "cancellation emits a reentrant arrival opportunity");
  const late = await concurrent;
  watcher.unsubscribe();
  assert(!late.result.isError, text(late.result));
  await run.completion;
  await idle(target);
  const messages = snapshot(target).messages.slice(run.offset);
  const envelopes = messages.filter((message) => message.role === "user").map((message) => parsePeerMessages(text(message))).filter(Boolean);
  const merged = envelopes.find((batch) => batch.some(({ messageId }) => messageId === abort.value.id));
  assert(merged, "abort starts a new user turn");
  assert.deepEqual(merged.map(({ body }) => body), ["BEFORE_ABORT_STEER", "BEFORE_ABORT_FOLLOWUP", "AUTHORIZED_ABORT", "ARRIVED_DURING_ABORT"], "abort merges every pending transport/native message oldest first");
  const aborted = messages.findIndex((message) => message.role === "toolResult" && message.toolName === "kernel_code");
  const delivered = messages.findIndex((message) => parsePeerMessages(text(message))?.some(({ messageId }) => messageId === abort.value.id));
  assert(delivered > aborted, "new peer turn is admitted only after the interrupted tool settles");
  assert(snapshot(target).recentOperations.some((operation) => operation.operationId !== run.admission.operationId && operation.requestIds.includes(`session-message:${abort.value.id}`)), "abort delivery belongs to a new operation");
  const retained = await call(target, "kernel_code", { code: "assert delivery_sentinel == 73129\nassert delivery_cell_count == 1\nprint('KERNEL_AND_VARIABLES_RETAINED')" });
  assert(!retained.result.isError, text(retained.result));
  assert.equal(snapshot(target).kernel.kernelId, kernelId);
  await host.session(target).reload();
  const next = await start(target, "No replay after reload");
  await next.completion;
  const received = snapshot(target).messages.filter((message) => message.role === "user").flatMap((message) => parsePeerMessages(text(message)) ?? []);
  for (const receipt of [steer.value, follow.value, abort.value, late.value]) {
    assert.equal(received.filter(({ messageId }) => messageId === receipt.id).length, 1, "accepted messages are consumed once, never replayed on reload");
  }
}
