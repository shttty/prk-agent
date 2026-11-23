import assert from "node:assert/strict";
import test from "node:test";
import { projectConversation } from "../../../../web/chat/conversation/project-conversation.js";
import { thinkingPreview } from "../../../../web/chat/transcript/reasoning/thinking-preview.js";
import { finishedTurnGrouping } from "../../../../web/chat/transcript/turns/turn-grouping.js";

test("thinking preview advances one completed paragraph at a time, then shows the first line; ** is dropped", () => {
  const first = "**Inspecting the repo**\nLooking at files.";
  assert.equal(thinkingPreview(first, true), "", "the first paragraph is still being written");
  assert.equal(thinkingPreview(`${first}\n\n**Planning** the`, true), "Inspecting the repo");
  assert.equal(thinkingPreview(`${first}\n\n**Planning** the edit\n\nWriting`, true), "Planning the edit", "the latest completed paragraph wins");
  assert.equal(thinkingPreview(`${first}\n\n**Planning** the edit\n\nWriting`, false), "Inspecting the repo", "settled: first line of the whole text");
});

test("only thinking blocks with text become rows, inside the turn's process group", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "go" }] },
    { role: "assistant", stopReason: "toolUse", content: [
      { type: "thinking", thinking: "", thinkingSignature: "sig-only" },
      { type: "thinking", thinking: "  \n", thinkingSignature: "blank" },
      { type: "thinking", thinking: "secret", thinkingSignature: "enc", redacted: true },
      { type: "thinking", thinking: "**Reading** the log" },
      { type: "toolCall", id: "b1", name: "bash", arguments: { command: "ls" } },
    ] },
    { role: "toolResult", toolCallId: "b1", toolName: "bash", isError: false, content: [{ type: "text", text: "a" }] },
    { role: "assistant", stopReason: "stop", content: [{ type: "thinking", thinking: "Done." }, { type: "text", text: "answer" }] },
  ];
  const session = { snapshot: { sessionId: "w", messages }, toolRuns: new Map(), streams: new Map(), operations: new Map(), nativeFeedback: [] };
  const turn = projectConversation({ selectedSessionId: "w", session }).at(-1);
  assert.deepEqual(turn.content.map((part) => part.type), ["reasoning", "tool-call", "reasoning", "text"]);
  assert.deepEqual(finishedTurnGrouping(turn.content), [{ groupKey: "process", indices: [0, 1, 2] }, { groupKey: undefined, indices: [3] }]);

  const labelled = projectConversation({ selectedSessionId: "w", session: { ...session, extensionUi: { hiddenThinkingLabel: "hidden" } } }).at(-1);
  assert.equal(labelled.content.filter((part) => part.type === "reasoning").length, 0, "a plugin label hides thinking text");
});
