import assert from "node:assert/strict";
import { historicalToolRuns } from "../../web/workbench/payloads/tool-runs/historical-tool-runs.js";
import { ingestToolEvent } from "../../web/workbench/payloads/tool-runs/ingest-tool-event.js";
import { projectConversation } from "../../web/chat/conversation/project-conversation.js";

// Live tool events as the Gateway forwards them. Calls a tool made through ctx.executeTool() carry the SDK's
// structured `parentToolCallId` (toolCallId `<parent>/<n>`); model-issued calls do not.
const W = "w";
const at = (second) => new Date(Date.UTC(2026, 9, 14, 12, 0, second)).toISOString();
const top = (id, phase, second) => [{
  sdkType: `tool_execution_${phase}`, toolCallId: id, toolName: "kernel_code",
  ...(phase === "end" ? { result: { content: [{ type: "text", text: `${id} out` }] }, isError: false } : { args: { code: "gateway.web_search()" } }),
}, at(second)];

function liveTurn(runs, operationId, id, second) {
  const events = [
    top(id, "start", second), [{ sdkType: "tool_execution_start", toolCallId: `${id}/1`, toolName: "web_search", args: {}, parentToolCallId: id }, at(second + 1)],
    [{ sdkType: "tool_execution_end", toolCallId: `${id}/1`, toolName: "web_search", result: { content: [{ type: "text", text: "r1" }] }, isError: false, parentToolCallId: id }, at(second + 2)],
    [{ sdkType: "tool_execution_start", toolCallId: `${id}/2`, toolName: "fetch_content", args: {}, parentToolCallId: id }, at(second + 3)],
    [{ sdkType: "tool_execution_end", toolCallId: `${id}/2`, toolName: "fetch_content", result: { content: [{ type: "text", text: "r2" }] }, isError: false, parentToolCallId: id }, at(second + 4)],
    top(id, "end", second + 5),
  ];
  return events.reduce((acc, [details, timestamp]) => ingestToolEvent(acc, details, W, operationId, timestamp), runs);
}

const user = (text) => ({ role: "user", content: [{ type: "text", text }] });
const call = (id) => ({ role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id, name: "kernel_code", arguments: { code: "gateway.web_search()" } }] });
// The SDK saves nested calls only as a bounded record on the outer result message.
const result = (id) => ({ role: "toolResult", toolCallId: id, toolName: "kernel_code", content: [{ type: "text", text: `${id} out` }], nestedCalls: [{ name: "web_search", status: "ok" }, { name: "fetch_content", status: "ok" }] });
const final = (text) => ({ role: "assistant", stopReason: "stop", content: [{ type: "text", text }] });

const project = (messages, toolRuns, streams = new Map()) => projectConversation({ selectedSessionId: W, session: { snapshot: { sessionId: "s", messages }, toolRuns, streams, operations: new Map(), nativeFeedback: [] } });
const toolIds = (rows) => rows.flatMap((row) => row.content.filter((part) => part.type === "tool-call").map((part) => part.toolCallId));
// Same merge as store.js on a snapshot: history first, live-only runs and unfinished live state kept.
const merge = (messages, live) => {
  const runs = historicalToolRuns(messages, W);
  for (const [key, run] of live) { const saved = runs.get(key); runs.set(key, saved?.ended && !run.ended ? { ...run, ...saved, startedAt: run.startedAt, endedAt: run.endedAt } : run); }
  return runs;
};

// Turn 1, live: one top-level run, no nested rows; the turn has exactly one tool.
let live = liveTurn(new Map(), "op-1", "call_a", 0);
assert.deepEqual([...live.keys()], [`${W}:call_a`], "nested events create no tool runs");
const turn1 = [user("one"), call("call_a"), result("call_a"), final("reply one")];
assert.deepEqual(toolIds(project(turn1.slice(0, 1), live, new Map([["op-1", [{ afterTools: 1, text: "reply one" }]]]))), ["call_a"], "live turn has one tool group row");

// History caught up == refreshed page, for the whole conversation after turn 2 as well.
const turn2 = [user("two"), call("call_b"), result("call_b"), final("reply two")];
const history = [...turn1, ...turn2];
assert.deepEqual(toolIds(project(turn1, merge(turn1, live))), toolIds(project(turn1, historicalToolRuns(turn1, W))), "turn 1 matches a refresh");
live = liveTurn(live, "op-2", "call_b", 20);
assert.deepEqual(toolIds(project(turn1.concat(turn2.slice(0, 1)), live, new Map([["op-2", [{ afterTools: 1, text: "reply two" }]]]))), ["call_a", "call_b"], "turn 2 live shows only its own top-level tool");
assert.deepEqual([...live.keys()], [`${W}:call_a`, `${W}:call_b`], "earlier nested events do not accumulate");
assert.deepEqual(project(history, merge(history, live)).map((row) => [row.role, row.content.map((part) => part.type === "tool-call" ? part.toolCallId : part.type)]),
  project(history, historicalToolRuns(history, W)).map((row) => [row.role, row.content.map((part) => part.type === "tool-call" ? part.toolCallId : part.type)]), "conversation after history catches up matches a refresh");

// A model-issued id may itself contain "/" (provider formats); only the structured parent field marks a nested call.
const slash = ingestToolEvent(new Map(), { sdkType: "tool_execution_start", toolCallId: "call/with/slash", toolName: "bash", args: {} }, W, "op-3", at(40));
assert.deepEqual([...slash.keys()], [`${W}:call/with/slash`], "top-level id containing slashes is kept");
console.log("PASS nested tool_execution events (parentToolCallId) never become live tool rows; live and refreshed conversations agree");
