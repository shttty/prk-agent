import { safeText } from "../../workbench/payloads/safe-text.js";
import { isBusy } from "./is-busy.js";
import { exactPrintable } from "./messages/exact-printable.js";
import { toolId } from "./tools/tool-id.js";
import { makeNativeFeedbackMessage } from "./messages/make-native-feedback-message.js";
import { historicalRunMap } from "./tools/historical-run-map.js";
import { liveRunMap } from "./tools/live-run-map.js";
import { historicalMessages } from "./history/historical-messages.js";
import { appendLiveOperations } from "./live/append-live-operations.js";
import { mergeTurns } from "./turns/merge-turns.js";
export function projectConversation(state) {
  const sessionId = safeText(state?.selectedSessionId) || "session";
  const snapshotMessages = state.session.snapshot?.messages || [];
  const runs = historicalRunMap(snapshotMessages, sessionId);
  const liveRuns = liveRunMap(state, sessionId);
  for (const [key, value] of liveRuns) {
    const old = runs.get(key);
    if (old) runs.set(key, { ...old, run: value.run, call: { ...old.call, ...(safeText(value.run?.code) ? value.call : {}) } });
    else runs.set(key, value);
  }
  for (const record of runs.values()) {
    const cached = state.session.toolContents?.get(JSON.stringify([state.session.snapshot?.sessionId, toolId(record.call, "")]));
    if (!cached) continue;
    const inputPreview = record.call?.inputPreview;
    const outputPreview = record.result?.outputPreview || record.run?.outputPreview;
    if (inputPreview && cached.inputVersion === inputPreview.version) record.call = { ...record.call, args: cached.args, arguments: cached.args, argumentsError: cached.argumentsError, inputLoaded: true };
    if (outputPreview && cached.outputVersion === outputPreview.version) {
      record.call = { ...record.call, outputLoaded: true };
      if (record.result !== undefined || record.run?.ended) record.result = { ...cached.result, outputPreview };
      else record.run = { ...record.run, output: exactPrintable(cached.result), partialResult: cached.result };
    }
  }
  const historical = historicalMessages(state, runs, sessionId);
  const output = historical.output;
  // User messages come only from SDK history; local requests are transport status, not history.
  for (const [index, feedback] of state.session.nativeFeedback.entries()) {
    output.push(makeNativeFeedbackMessage(feedback, `native-feedback-${feedback.requestId || index}`, new Date()));
  }
  appendLiveOperations(output, state, runs, historical.placedTools);
  output.push(...historical.afterLive);
  const merged = mergeTurns(output);
  const last = merged.at(-1);
  if ((state.running ?? isBusy(state)) && last?.role === "assistant" && last.metadata?.custom?.toolUse
    && !last.content.some((part) => (part?.result?.result || part?.result)?.details?.interrupted === true)) {
    merged[merged.length - 1] = { ...last, status: { type: "running" } };
  }
  return merged;
}
