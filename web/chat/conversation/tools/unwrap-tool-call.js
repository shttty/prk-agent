import { isRecord } from "../../../workbench/payloads/is-record.js";

/**
 * Direct mode's `tool_call` meta tool runs exactly one hidden tool (args `{name, args}`, see the Gateway's call-tool)
 * and returns that tool's result, so its row is shown as the real tool. Returns `{ toolName, args, result, callId }` or
 * null. `callId` is the nested execution's own id (`<outer id>/1`: the SDK numbers a caller's nested calls from 1), the
 * key plugin renderers are published under. Arguments come from the call (live runs carry them as JSON text in `code`),
 * else from the SDK's nested-call record; that record entry is the same call and is dropped from the nested summary.
 */
export function unwrapToolCall(toolName, toolCallId, rawArgs, result) {
  if (toolName !== "tool_call") return null;
  let call = rawArgs;
  if (isRecord(call) && call.name === undefined && typeof call.code === "string") {
    try { call = JSON.parse(call.code); } catch { call = null; }
  }
  const nested = result?.nestedCalls;
  const calls = Array.isArray(nested?.calls) ? nested.calls : [];
  const ownId = `${toolCallId}/1`;
  const own = calls.find((entry) => entry?.id === ownId);
  const name = isRecord(call) && typeof call.name === "string" && call.name ? call.name : typeof own?.name === "string" && own.name ? own.name : "";
  if (!name) return null;
  const args = isRecord(call) && isRecord(call.args) ? call.args : isRecord(own?.arguments) ? own.arguments : {};
  const rest = own ? calls.filter((entry) => entry !== own) : calls;
  return { toolName: name, args, callId: ownId, result: nested && rest !== calls ? { ...result, nestedCalls: { ...nested, calls: rest } } : result };
}
