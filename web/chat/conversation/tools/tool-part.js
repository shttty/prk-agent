import { safeText } from "../../../workbench/payloads/safe-text.js";
import { argsText } from "./args-text.js";
import { toolId } from "./tool-id.js";
import { unwrapToolCall } from "./unwrap-tool-call.js";
export function toolPart(call, result, live) {
  const id = toolId(call, "tool-call");
  const name = safeText(call?.toolName) || safeText(call?.name) || safeText(live?.toolName) || "tool";
  const settled = result !== undefined ? result : live?.ended ? (live.unknown ? { outcome: "unknown" } : live.resultValue ?? live.result) : result;
  const via = unwrapToolCall(name, id, call?.args || call?.arguments, settled);
  const rawArgs = via ? via.args : call?.args || call?.arguments;
  const args = rawArgs || {};
  const resultValue = via ? via.result : settled;
  const ended = Boolean(live?.ended || resultValue !== undefined);
  const resultObject = resultValue?.result || resultValue;
  const unknown = Boolean(live?.unknown || resultObject?.details?.outcome === "unknown" || resultObject?.outcome === "unknown");
  const startedAt = live?.startedAt ? Date.parse(live.startedAt) : NaN;
  const completedAt = live?.endedAt ? Date.parse(live.endedAt) : NaN;
  const inputPreview = call?.inputPreview;
  const outputPreview = resultObject?.outputPreview || live?.outputPreview;
  const toolName = via ? via.toolName : name;
  // The call title sits on the toolcall block; kernel_code keeps it as its own argument (a live run's `args` carry only the code).
  const title = safeText(call?.title).trim() || (toolName === "kernel_code" ? safeText(call?.arguments?.title ?? args.title).trim() : "");
  return {
    type: "tool-call",
    toolCallId: id,
    toolName,
    ...(title ? { title } : {}),
    args,
    argsText: inputPreview && !call.inputLoaded ? inputPreview.preview : call?.argumentsError || argsText(rawArgs, args),
    ...(ended && resultValue !== undefined ? { result: resultValue } : {}),
    ...(ended && (live?.isError || resultValue?.isError) ? { isError: true } : {}),
    ...((Number.isFinite(startedAt) || Number.isFinite(completedAt)) ? {
      timing: {
        ...(Number.isFinite(startedAt) ? { startedAt } : {}),
        ...(Number.isFinite(completedAt) ? { completedAt } : {}),
      },
    } : {}),
    ...(live ? { artifact: { output: safeText(live.output), running: !live.ended, unknown: Boolean(live.unknown) } } : {}),
    metadata: {
      ...(unknown ? { outcome: "unknown" } : {}),
      ...(inputPreview ? { inputPreview, inputLoaded: call.inputLoaded === true } : {}),
      ...(outputPreview ? { outputPreview, outputLoaded: call?.outputLoaded === true } : {}),
      ...(via ? { via: "tool_call", renderId: via.callId } : {}),
    },
  };
}
