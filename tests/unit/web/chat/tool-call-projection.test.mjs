import assert from "node:assert/strict";
import test from "node:test";
import { projectConversation } from "../../../../web/chat/conversation/project-conversation.js";
import { ingestToolEvent } from "../../../../web/workbench/payloads/tool-runs/ingest-tool-event.js";

const W = "w";
const at = (second) => new Date(Date.UTC(2026, 10, 3, 12, 0, second)).toISOString();
const project = (messages, toolRuns = new Map()) => projectConversation({ selectedSessionId: W, session: { snapshot: { sessionId: W, messages }, toolRuns, streams: new Map(), operations: new Map(), nativeFeedback: [] } });
const tools = (rows) => rows.flatMap((row) => row.content.filter((part) => part.type === "tool-call"));
const outer = { name: "session_list", args: { sessionId: "native-child", limit: 3 } };
const call = { role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id: "c1", name: "tool_call", arguments: outer }] };
// tool_call returns the hidden tool's result; the SDK records the hidden call itself (and its own sub-calls) as nested calls.
const result = (isError = false) => ({ role: "toolResult", toolCallId: "c1", toolName: "tool_call", isError, content: [{ type: "text", text: "[]" }], details: [],
  nestedCalls: { complete: true, calls: [{ id: "c1/1", name: "session_list", status: isError ? "error" : "ok", arguments: outer.args }, { id: "c1/1/1", name: "web_search", status: "ok" }] } });

test("a tool_call row shows the hidden tool's name, arguments, result and status, marked via tool_call", () => {
  const [part] = tools(project([{ role: "user", content: [{ type: "text", text: "go" }] }, call, result()]));
  assert.equal(part.toolCallId, "c1", "the outer call id stays the row key");
  assert.equal(part.toolName, "session_list");
  assert.deepEqual(part.args, outer.args);
  assert.deepEqual(JSON.parse(part.argsText), { sessionId: "native-child", limit: 3 });
  assert.equal(part.metadata.via, "tool_call");
  assert.deepEqual(part.result.nestedCalls.calls.map((entry) => entry.id), ["c1/1/1"], "the hidden call is the row itself; only its own sub-calls stay nested");
  assert.equal(tools(project([call, result(true)]))[0].isError, true, "the hidden tool's failure is the row's failure");
});

test("live tool_call events project the same row as the refreshed history; nested events add none", () => {
  let runs = new Map();
  const events = [
    [{ sdkType: "tool_execution_start", toolCallId: "c1", toolName: "tool_call", args: outer }, at(0)],
    [{ sdkType: "tool_execution_start", toolCallId: "c1/1", toolName: "session_list", args: outer.args, parentToolCallId: "c1" }, at(1)],
  ];
  for (const [details, timestamp] of events) runs = ingestToolEvent(runs, details, W, "op", timestamp);
  const [running] = tools(project([call], runs));
  assert.equal(running.toolName, "session_list", "the running row is already the real tool");
  assert.deepEqual(running.args, outer.args);
  assert.equal(running.artifact.running, true);
  runs = ingestToolEvent(runs, { sdkType: "tool_execution_end", toolCallId: "c1", toolName: "tool_call", result: { content: [{ type: "text", text: "[]" }], details: [] }, isError: false }, W, "op", at(2));
  const live = tools(project([call], runs));
  const refreshed = tools(project([call, result()]));
  assert.deepEqual(live.map((part) => [part.toolCallId, part.toolName, part.argsText, part.metadata.via]), refreshed.map((part) => [part.toolCallId, part.toolName, part.argsText, part.metadata.via]));
});

test("tool_search and ordinary calls are untouched", () => {
  const messages = [{ role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id: "s1", name: "tool_search", arguments: { query: "session" } }, { type: "toolCall", id: "b1", name: "bash", arguments: { command: "ls" } }] }];
  assert.deepEqual(tools(project(messages)).map((part) => [part.toolName, part.metadata.via]), [["tool_search", undefined], ["bash", undefined]]);
});
