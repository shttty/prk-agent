import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkBoundaries(fixture) {
  const { root, owner, spawn, snapshot, start, call, idle, nativeId, text, until } = fixture;
  const target = await spawn("Boundary recipient");
  for (const delivery of ["steer", "followUp", "abort"]) {
    const sent = await call(owner, "session_send", { to: nativeId(target), message: `IDLE_${delivery}`, delivery });
    assert(!sent.result.isError, text(sent.result));
    assert.equal(sent.value.delivery, "delivered", `${delivery} wakes an idle recipient`);
    await idle(target);
    assert(snapshot(target).messages.some((message) => message.role === "user" && parsePeerMessages(text(message))?.some(({ messageId }) => messageId === sent.value.id)));
  }
  const ready = async (step) => {
    try { return await readFile(join(root, `chain-ready-${step}`), "utf8") === "ready"; }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
  };
  const run = await start(target, "CHAIN");
  await until(() => ready(1), "first chain cell executing");
  const follow = await call(owner, "session_send", { to: nativeId(target), message: "FOLLOWUP_AFTER_RUN", delivery: "followUp" });
  assert(!follow.result.isError, text(follow.result));
  assert.equal(follow.value.delivery, "queued");
  await until(() => snapshot(target).queuedMessages.followUp.some((message) => parsePeerMessages(message)?.some(({ messageId }) => messageId === follow.value.id)), "Pi owns the followUp queue");
  const steer = await call(owner, "session_send", { to: nativeId(target), message: "STEER_AT_BOUNDARY" });
  assert(!steer.result.isError, text(steer.result));
  assert.equal(steer.value.delivery, "queued");
  assert(!snapshot(target).messages.slice(run.offset).some((message) => message.role === "user" && parsePeerMessages(text(message))), "busy steer remains outside the transcript until turn_end");
  await writeFile(join(root, "chain-release-1"), "release");
  await until(() => ready(2), "second chain cell executing");
  assert(snapshot(target).messages.slice(run.offset).some((message) => message.role === "user" && parsePeerMessages(text(message))?.some(({ messageId }) => messageId === steer.value.id)), "steer is admitted at the first turn boundary");
  assert(!snapshot(target).messages.slice(run.offset).some((message) => message.role === "user" && parsePeerMessages(text(message))?.some(({ messageId }) => messageId === follow.value.id)), "followUp stays in Pi while subsequent tool calls remain");
  await writeFile(join(root, "chain-release-2"), "release");
  const completion = await run.completion;
  assert.equal(completion.status, "completed");
  await idle(target);
  const messages = snapshot(target).messages.slice(run.offset);
  const toolResults = messages.flatMap((message, index) => message.role === "toolResult" && message.toolName === "kernel_code" ? [index] : []);
  assert.equal(toolResults.length, 2, "the run performs both real kernel calls");
  const steerIndex = messages.findIndex((message) => parsePeerMessages(text(message))?.some(({ messageId }) => messageId === steer.value.id));
  const followIndex = messages.findIndex((message) => parsePeerMessages(text(message))?.some(({ messageId }) => messageId === follow.value.id));
  const doneIndex = messages.findIndex((message) => message.role === "assistant" && text(message) === "CHAIN_DONE");
  assert(steerIndex > toolResults[0] && steerIndex < toolResults[1], "steer enters after current tools, before the next model/tool turn");
  assert(followIndex > doneIndex && doneIndex > toolResults[1], "followUp enters only after the complete multi-tool run finishes");
  assert(completion.requestIds.includes(`session-message:${steer.value.id}`));
  assert(completion.requestIds.includes(`session-message:${follow.value.id}`));
  assert.equal(messages.filter((message) => parsePeerMessages(text(message))?.some(({ messageId }) => messageId === follow.value.id)).length, 1);
  return target;
}
