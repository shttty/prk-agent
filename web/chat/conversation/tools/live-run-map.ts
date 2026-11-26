import { safeText } from "../../../workbench/payloads/safe-text.js";
import type { ConversationState, ToolRecord } from "../conversation-types.ts";
import { toolId } from "./tool-id.ts";
export function liveRunMap(state: ConversationState, sessionId: string): Map<string, ToolRecord> {
  const runs = new Map<string, ToolRecord>();
  for (const [key, run] of state.session.toolRuns) {
    const id = toolId(run, safeText(run.key || key).slice(safeText(run.sessionId || sessionId).length + 1));
    runs.set(`${sessionId}:${id}`, { run, call: { toolCallId: id, toolName: safeText(run.toolName) || "tool", args: run.code ? { code: run.code } : {}, ...(run.inputPreview ? { inputPreview: run.inputPreview } : {}) } });
  }
  return runs;
}
