import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkDeadlineFreeHook({ directGeneration, directSession, faux, fauxAssistantMessage, fauxToolCall, waitEvent, remoteEvents, within, text, events, failures, proof }) {
  const slowToken = randomUUID();
  const slowId = randomUUID();
  const slowPid = directGeneration.registration.pid;
  faux.setResponses([fauxAssistantMessage(fauxToolCall("hook_probe", { mode: "remote-slow", token: slowToken }, { id: slowId }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed slow hook.")]);
  const slowStarted = performance.now();
  const slowTurn = directSession.prompt("Run the owned six-second hook");
  await waitEvent(remoteEvents, (entry) => entry.event === "call-enter" && entry.token === slowToken, "Six-second remote hook entered");
  await within(slowTurn, 15000, "Six-second deadline-free hook");
  const slowDurationMs = performance.now() - slowStarted;
  const slowResult = directSession.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === slowId);
  assert(slowResult);
  assert.equal(slowResult.isError, false, text(slowResult));
  assert.equal(slowResult.details.pid, slowPid);
  assert(slowDurationMs >= 6000, "The real six-second hook must outlive the two-second control deadline");
  assert((await events(remoteEvents)).some((entry) => entry.event === "slow-completed" && entry.token === slowToken));
  process.kill(slowPid, 0);
  assert.equal(directGeneration.registration.pid, slowPid);
  assert.deepEqual(failures, [], "Slow hooks must not fail their host generation");
  proof("deadline-free-remote-hook", { requestTimeoutMs: 2000, hookDelayMs: 6000, durationMs: slowDurationMs, pid: slowPid, generation: directGeneration.generation, toolCallId: slowId });
}
