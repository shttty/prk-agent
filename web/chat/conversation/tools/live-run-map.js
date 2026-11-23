import { safeText } from "../../../workbench/payloads/safe-text.js";
import { toolId } from "./tool-id.js";
export function liveRunMap(state, sessionId) {
  const runs = new Map();
  for (const [key, run] of state.session.toolRuns) {
    const id = toolId(run, safeText(run?.key || key).slice(safeText(run?.sessionId || sessionId).length + 1));
    runs.set(`${sessionId}:${id}`, { run, call: { toolCallId: id, toolName: safeText(run?.toolName) || "tool", args: run?.code ? { code: run.code } : {}, ...(run.inputPreview ? { inputPreview: run.inputPreview } : {}) } });
  }
  return runs;
}
