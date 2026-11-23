import assert from "node:assert/strict";
import { getCurrentTools } from "@earendil-works/pi-ai";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkBatchResults({ host, call, idle, get, owner, seenContexts, text }) {
  const context = "BATCH_SHARED_CONTEXT_7319: inspect independent inputs on the selected target; submit typed results without changing files.";
  const outputSchema = { type: "object", properties: { count: { $ref: "#/$defs/count" }, source: { enum: ["first", "second"] } }, required: ["count", "source"], additionalProperties: false, $defs: { count: { type: "integer", minimum: 0 } } };
  const before = host.workbench().sessions.map(({ sessionId }) => sessionId).sort();
  await call(owner, "session_spawn", { context, tasks: [
    { task: "No admission for a batch with an invalid schema", label: "Rejected batch sibling" },
    { task: "Reject malformed schema", label: "Malformed schema", outputSchema: { type: "object", required: "count" } },
  ] }, /outputSchema/);
  assert.deepEqual(host.workbench().sessions.map(({ sessionId }) => sessionId).sort(), before, "Schema preflight rejects the entire batch before creating SDK sessions");
  const admittedAfter = Date.now();
  const admitted = await call(owner, "session_spawn", { context, tasks: [
    { task: "BATCH_FIRST_7319: inspect the first independent input and submit its count", label: "First batch input", role: "batchDirect", lifecycle: "persistent", outputSchema },
    { task: "BATCH_SECOND_7319: inspect the second independent input and submit its count", label: "Second batch input", role: "batchCode", lifecycle: "persistent", outputSchema },
  ] });
  assert.equal(admitted.children.length, 2);
  assert.equal(new Set(admitted.children.flatMap(({ sessionId, taskId }) => [sessionId, taskId])).size, 4, "Every independent admission has distinct native session and task IDs");
  assert.deepEqual(admitted.children.map(({ sessionName }) => sessionName), ["First batch input", "Second batch input"]);
  for (const child of admitted.children) assert.deepEqual(Object.keys(child).sort(), ["index", "sessionId", "sessionName", "taskId"]);
  const [first, second] = admitted.children;
  await Promise.all(admitted.children.map(({ sessionId }) => idle(sessionId)));
  for (const child of admitted.children) {
    assert.equal(get(child.sessionId).sessionId, child.sessionId);
    assert.equal(get(child.sessionId).sessionId, child.sessionId, "Model and management addresses share the native ID");
    assert.equal(get(child.sessionId).derivation.taskId, child.taskId);
    assert.equal(get(child.sessionId).derivation.context, context);
    assert.equal(get(child.sessionId).startedAt, get(child.sessionId).derivation.startedAt, "The workbench row projects this derived task's persisted start");
    assert(get(child.sessionId).startedAt >= admittedAfter && get(child.sessionId).startedAt <= Date.now(), "Task start is an admission-time epoch timestamp");
    assert.equal(Object.hasOwn(get(child.sessionId), "finishedAt"), false, "A working task has no finish timestamp field");
    assert.equal(Object.hasOwn(get(child.sessionId).derivation, "result"), false, "A working task has no finished result");
  }
  const firstRequest = seenContexts.find((entry) => entry.messages.some((message) => message.role === "user" && !text(message).startsWith("TOOL ") && text(message).includes("BATCH_FIRST_7319")));
  const secondRequest = seenContexts.find((entry) => entry.messages.some((message) => message.role === "user" && !text(message).startsWith("TOOL ") && text(message).includes("BATCH_SECOND_7319")));
  assert(firstRequest && secondRequest, "Both real child SDK sessions reach the provider");
  const firstTools = getCurrentTools(firstRequest.messages).map(({ name }) => name);
  assert(firstTools.includes("read") && firstTools.includes("session_result"), "Read-only research can use native direct tools");
  const secondTools = getCurrentTools(secondRequest.messages).map(({ name }) => name);
  assert(secondTools.includes("kernel_code") && !secondTools.includes("session_result") && !secondTools.includes("session_spawn"), "Configured role code mode keeps session tools behind Gateway callbacks independently of the native-tools switch");
  const notifications = () => host.session(owner).getSnapshot().messages.flatMap((entry) => parsePeerMessages(text(entry)) ?? []).map(({ body }) => body.split("\n").find((line) => line.startsWith("{"))).filter(Boolean).map((body) => JSON.parse(body)).filter((entry) => entry.child === first.sessionId && entry.taskId === first.taskId);
  const original = structuredClone(get(first.sessionId).derivation);
  await call(first.sessionId, "session_result", { summary: "Missing structured output" }, /requires.*output/);
  await call(first.sessionId, "session_result", { summary: "Invalid structured output", output: { count: "wrong", source: "first" } }, /outputSchema/);
  assert.deepEqual(get(first.sessionId).derivation, original, "Invalid results never change the task phase or persist success");
  assert.equal(Object.hasOwn(get(first.sessionId), "finishedAt"), false, "Invalid results never publish a finish timestamp");
  assert.equal(notifications().length, 0, "Invalid results never enter the parent's success inbox");
  const output = { count: 3, source: "first" };
  const submittedAfter = Date.now();
  const submitted = await call(first.sessionId, "session_result", { summary: "Typed batch result", artifacts: ["counts.json"], output });
  await idle(owner);
  const observation = await call(owner, "session_list", { sessionId: first.sessionId });
  const result = observation.result;
  assert.deepEqual(result.output, output);
  assert.equal(result.output.count, 3, "Parent reads structured fields without parsing a summary");
  assert.equal(result.startedAt, original.startedAt);
  assert(result.finishedAt >= submittedAfter && result.finishedAt >= result.startedAt && result.finishedAt <= Date.now());
  assert.equal(get(first.sessionId).finishedAt, result.finishedAt, "The workbench projects the successful task finish");
  const notice = notifications().at(-1);
  assert.deepEqual(notice.result.output, output, "The peer inbox preserves field-readable structured output");
  assert.equal(notice.result.startedAt, original.startedAt);
  assert.equal(notice.result.finishedAt, result.finishedAt);
  assert.equal(notice.result.id, submitted.resultId);
  assert.equal(notice.child, first.sessionId);
  assert.equal(notice.taskId, first.taskId);
  await call(first.sessionId, "session_result", { summary: "Typed batch result", artifacts: ["counts.json"], output: { count: 4, source: "first" } }, /different result/);
  assert.deepEqual(get(first.sessionId).derivation.result.output, output, "Resubmission cannot replace structured output");
  await call(first.sessionId, "session_result", { summary: "Typed batch result", artifacts: ["counts.json"], output });
  assert.equal(get(first.sessionId).derivation.result.finishedAt, result.finishedAt, "Identical resubmission retains the original finish timestamp");
  assert.equal(notifications().length, 1, "Identical resubmission never enqueues a duplicate result");
  assert.equal(get(first.sessionId).derivation.phase, "delivered", "Receipt delivery requires no acknowledgment tool");
  await call(owner, "session_manage", { action: "destroy", child: first.sessionId });
  const submittedArchive = host.workbench().archive.flatMap(({ sessions }) => sessions).find(({ sessionId }) => sessionId === first.sessionId);
  assert.equal(submittedArchive.finishedAt, result.finishedAt, "Archiving a submitted child never replaces its submission finish time");
  assert.equal(submittedArchive.startedAt, result.startedAt);
  const secondStartedAt = get(second.sessionId).startedAt;
  const destroyedAfter = Date.now();
  await call(owner, "session_manage", { action: "destroy", child: second.sessionId });
  const endedArchive = host.workbench().archive.flatMap(({ sessions }) => sessions).find(({ sessionId }) => sessionId === second.sessionId);
  assert.equal(endedArchive.startedAt, secondStartedAt);
  assert(endedArchive.finishedAt >= destroyedAfter && endedArchive.finishedAt <= Date.now(), "Ending an unsubmitted task publishes its authoritative archive finish time");
  await call(owner, "session_spawn", { context, tasks: [
    { task: "Partial admission keeps this successful child", label: "Successful partial admission", lifecycle: "persistent" },
    { task: "Partial admission reports this failed target", label: "Failed partial admission", target: "not-configured" },
  ] }, /not configured/);
  const snapshot = host.session(owner).getSnapshot();
  const projected = snapshot.messages.findLast((entry) => entry.role === "toolResult" && entry.toolName === "session_spawn");
  const response = projected.outputPreview ? host.toolContent(owner, projected.toolCallId).result : projected;
  assert.equal(response.details.children.length, 1);
  assert.equal(response.details.children[0].index, 0);
  assert.equal(response.details.errors[0].index, 1);
  assert(get(response.details.children[0].sessionId), "A failed sibling never loses the actual admitted child identity");
  await idle(response.details.children[0].sessionId);
  await call(owner, "session_manage", { action: "destroy", child: response.details.children[0].sessionId });
}
