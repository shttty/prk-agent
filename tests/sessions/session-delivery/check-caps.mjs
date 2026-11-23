import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkCaps(fixture) {
  const { host, owner, spawn, snapshot, start, call, idle, nativeId, text, until } = fixture;
  const target = await spawn("Capped recipient");
  const run = await start(target, `TOOL ${JSON.stringify({ tool: "kernel_code", args: { code: "import time\ntime.sleep(30)" } })}`);
  await until(() => snapshot(target).kernel?.state === "busy", "capped recipient kernel busy");
  const accepted = [];
  for (const message of ["one", "two", "three"]) {
    const sent = await call(owner, "session_send", { to: nativeId(target), message });
    assert(!sent.result.isError, text(sent.result));
    accepted.push(sent.value.id);
  }
  const excess = await call(owner, "session_send", { to: nativeId(target), message: "four" });
  assert.equal(excess.result.isError, true);
  assert.match(text(excess.result), /inbox message cap/i);
  const cancelled = await host.session(target).cancel({ operationId: run.admission.operationId });
  assert.equal(cancelled.status, "requested");
  assert.equal((await run.completion).status, "cancelled");
  const next = await start(target, "Resume after explicit user cancellation");
  await next.completion;
  await idle(target);
  const received = snapshot(target).messages.filter((message) => message.role === "user").flatMap((message) => parsePeerMessages(text(message)) ?? []);
  assert(!received.some(({ messageId }) => accepted.includes(messageId)), "normal user cancellation still discards the undelivered inbox");
  assert(!received.some(({ body }) => body === "four"), "cap rejection never reaches recipient");

  const second = await start(target, `TOOL ${JSON.stringify({ tool: "kernel_code", args: { code: "import time\ntime.sleep(30)" } })}`);
  await until(() => snapshot(target).kernel?.state === "busy", "character-capped recipient busy");
  const native = await call(owner, "session_send", { to: nativeId(target), message: "NATIVE_DISCARD", delivery: "followUp" });
  assert(!native.result.isError, text(native.result));
  await until(() => snapshot(target).queuedMessages.followUp.length > 0, "user-cancel followUp owned by Pi");
  const full = await call(owner, "session_send", { to: nativeId(target), message: "x".repeat(24) });
  assert(!full.result.isError, text(full.result));
  const overflow = await call(owner, "session_send", { to: nativeId(target), message: "y".repeat(9) });
  assert.equal(overflow.result.isError, true);
  assert.match(text(overflow.result), /inbox character cap/i);
  await host.session(target).cancel({ operationId: second.admission.operationId });
  await second.completion;
  const reset = await start(target, "Discard notices are not replayed inputs");
  await reset.completion;
  assert(!snapshot(target).messages.filter((message) => message.role === "user").flatMap((message) => parsePeerMessages(text(message)) ?? []).some(({ messageId }) => messageId === full.value.id));
  assert(!snapshot(target).messages.filter((message) => message.role === "user").flatMap((message) => parsePeerMessages(text(message)) ?? []).some(({ messageId }) => messageId === native.value.id), "user cancellation also discards native followUp input");
}
