import { safeText } from "../../workbench/payloads/safe-text.js";
import { isBusy } from "./is-busy.ts";
import { exactPrintable } from "./messages/exact-printable.ts";
import { toolId } from "./tools/tool-id.ts";
import { makeNativeFeedbackMessage } from "./messages/make-native-feedback-message.ts";
import { historicalRunMap } from "./tools/historical-run-map.ts";
import { liveRunMap } from "./tools/live-run-map.ts";
import { historicalMessages } from "./history/historical-messages.ts";
import { appendLiveOperations } from "./live/append-live-operations.ts";
import { mergeTurns } from "./turns/merge-turns.ts";
import { readPreview } from "./tools/read-preview.ts";
import { isPayload } from "../payload/is-payload.ts";
import type { ConversationState, TranscriptMessage } from "./conversation-types.ts";
export function projectConversation(state: ConversationState): TranscriptMessage[] {
  const sessionId = safeText(state.selectedSessionId) || "session";
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
    const inputPreview = record.call.inputPreview;
    const outputPreview = readPreview(record.result?.outputPreview) || record.run?.outputPreview;
    if (inputPreview && cached.inputVersion === inputPreview.version) {
      const args = isPayload(cached.args) ? cached.args : undefined;
      record.call = { ...record.call, args, arguments: args, argumentsError: cached.argumentsError, inputLoaded: true };
    }
    if (outputPreview && cached.outputVersion === outputPreview.version) {
      record.call = { ...record.call, outputLoaded: true };
      if (record.result !== undefined || record.run?.ended) record.result = { ...(isPayload(cached.result) ? cached.result : {}), outputPreview };
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
  if ((state.running ?? isBusy(state)) && last?.role === "assistant" && last.metadata.custom.toolUse
    && !last.content.some((part) => part.type === "tool-call" && isInterrupted(part.result))) {
    merged[merged.length - 1] = { ...last, status: { type: "running" } };
  }
  return merged;
}

function isInterrupted(result: unknown): boolean {
  const settled = isPayload(result) && isPayload(result.result) ? result.result : result;
  return isPayload(settled) && isPayload(settled.details) && settled.details.interrupted === true;
}
