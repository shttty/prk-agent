import assert from "node:assert/strict";
import test from "node:test";
import { formatPeerMessages } from "../../../shared/session-messages/format-peer-messages.js";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { projectPeerBody } from "../../../web/chat/transcript/messages/peer/project-peer-body.js";

const result = { id: "r1", summary: "## Done\n\n- shipped", artifacts: ["/w/shot.png", "/w/notes.md", 7], startedAt: 1_000, finishedAt: 61_000,
  patch: { path: "/w/p.patch", bytes: 10, stats: " a.js | 2 +-\n" } };
const resultBody = `[派生会话任务结果 / child=c1 / task=t1 / result=r1]\n${JSON.stringify({ child: "c1", taskId: "t1", result })}`;
const failure = { sessionId: "c2", sessionName: "Worker", operationId: "c2:o", type: "failed", summary: "Model request failed: 429" };
const failureBody = `[派生会话运行失败 / child=c2]\n${JSON.stringify(failure)}`;
// Bodies as the transcript receives them: the Gateway envelope's model hint is removed by parsePeerMessages.
const delivered = (body, expectReply) => parsePeerMessages(formatPeerMessages([{ sender: "c1", label: "Worker", messageId: "m1", replyTo: "", expectReply, body }]))[0].body;

test("a delivered result projects its summary, artifacts, patch stats and ids", () => {
  assert.deepEqual(projectPeerBody(resultBody), {
    kind: "result", child: "c1", taskId: "t1", resultId: "r1", summary: "## Done\n\n- shipped",
    artifacts: [{ path: "/w/shot.png", image: true }, { path: "/w/notes.md", image: false }],
    patchStats: " a.js | 2 +-\n", startedAt: 1_000, finishedAt: 61_000,
  });
  const bare = projectPeerBody(`[派生会话任务结果 / child=c1 / task=t1 / result=r1]\n${JSON.stringify({ child: "c1", taskId: "t1", result: { id: "r1", summary: "ok" } })}`);
  assert.deepEqual([bare.artifacts, bare.patchStats, bare.finishedAt], [[], "", null]);
});

test("a run-failure notice projects its summary and keeps the JSON as detail", () => {
  assert.deepEqual(projectPeerBody(failureBody), { kind: "failure", child: "c2", status: "failed", summary: failure.summary, detail: JSON.stringify(failure, null, 2) });
});

test("plain text, malformed JSON and mismatched tags fall back to plain rendering", () => {
  for (const body of [
    "Progress: halfway there.",
    `${resultBody} trailing`,
    "[派生会话任务结果 / child=c1 / task=t1 / result=r1]\n{\"child\":",
    resultBody.replace("result=r1", "result=r2"),
    failureBody.replace("child=c2", "child=c3"),
    `[派生会话运行失败 / child=c2]\n${JSON.stringify({ ...failure, summary: " " })}`,
    `[派生会话任务结果 / child=c1 / task=t1 / result=r1]\n${JSON.stringify({ child: "c1", taskId: "t1", result: [] })}`,
    undefined,
  ]) assert.deepEqual(projectPeerBody(body), { kind: "text" }, String(body));
});

test("the envelope's reply hint never reaches the projected body, with or without an expected reply", () => {
  for (const expectReply of [true, false]) {
    assert.equal(delivered(resultBody, expectReply), resultBody);
    assert.equal(projectPeerBody(delivered(resultBody, expectReply)).kind, "result");
    assert.equal(projectPeerBody(delivered(failureBody, expectReply)).kind, "failure");
    assert.equal(delivered("Plain update", expectReply), "Plain update");
  }
});
