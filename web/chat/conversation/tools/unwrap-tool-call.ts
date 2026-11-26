import { isPayload } from "../../payload/is-payload.ts";
import type { Payload } from "../../payload/is-payload.ts";

/**
 * Direct mode's `tool_call` meta tool runs exactly one hidden tool (args `{name, args}`, see the Gateway's call-tool)
 * and returns that tool's result, so its row is shown as the real tool. Returns `{ toolName, args, result, callId }` or
 * null. `callId` is the nested execution's own id (`<outer id>/1`: the SDK numbers a caller's nested calls from 1), the
 * key plugin renderers are published under. Arguments come from the call (live runs carry them as JSON text in `code`),
 * else from the SDK's nested-call record; that record entry is the same call and is dropped from the nested summary.
 */
export function unwrapToolCall(toolName: string, toolCallId: string, rawArgs: unknown, result: unknown): { toolName: string; args: Payload; callId: string; result: unknown } | null {
  if (toolName !== "tool_call") return null;
  let call = rawArgs;
  if (isPayload(call) && call.name === undefined && typeof call.code === "string") {
    // Boundary: a live run carries the call's arguments as JSON text.
    try { call = JSON.parse(call.code); } catch { call = null; }
  }
  const settled = isPayload(result) ? result : undefined;
  const nested = settled?.nestedCalls;
  const calls = isPayload(nested) && Array.isArray(nested.calls) ? nested.calls : [];
  const ownId = `${toolCallId}/1`;
  const own = calls.find((entry) => isPayload(entry) && entry.id === ownId);
  const ownRecord = isPayload(own) ? own : undefined;
  const name = isPayload(call) && typeof call.name === "string" && call.name ? call.name : typeof ownRecord?.name === "string" && ownRecord.name ? ownRecord.name : "";
  if (!name) return null;
  const args = isPayload(call) && isPayload(call.args) ? call.args : isPayload(ownRecord?.arguments) ? ownRecord.arguments : {};
  const rest = own ? calls.filter((entry) => entry !== own) : calls;
  return { toolName: name, args, callId: ownId, result: isPayload(nested) && rest !== calls ? { ...settled, nestedCalls: { ...nested, calls: rest } } : result };
}
