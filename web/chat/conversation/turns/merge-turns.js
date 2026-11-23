import { safeText } from "../../../workbench/payloads/safe-text.js";
import { hasRunningTool } from "../tools/has-running-tool.js";
import { mergedStatus } from "../tools/merged-status.js";
import { contentText } from "../content-text.js";
/**
 * Presentation only: consecutive assistant messages (text, tool calls, tool
 * results) between two user or system messages render as one assistant turn.
 * The turn keeps the SDK timestamps of its user message and final answer so the
 * process summary can show real elapsed time instead of an estimate.
 */
export function mergeTurns(messages) {
  const output = [];
  // Notices raised while a turn continues (after a tool step) render after the turn instead of splitting its fold.
  let heldNotices = [];
  const releaseNotices = () => { output.push(...heldNotices); heldNotices = []; };
  let turnOpen = false;
  let turnStartedAt;
  for (const message of messages) {
    const custom = message?.metadata?.custom || {};
    if (custom.extensionNotification && turnOpen) {
      heldNotices.push(message);
      continue;
    }
    turnOpen = message.role === "assistant" && Boolean(custom.toolOnly || custom.toolUse);
    if (message.role !== "assistant") {
      releaseNotices();
      if (message.role === "user") turnStartedAt = custom.sdkTimestamp;
      output.push(message);
      continue;
    }
    const answerAt = custom.toolOnly ? undefined : custom.sdkTimestamp;
    // A snapshot message can already hold a tool call whose live run has not ended.
    const ownStatus = hasRunningTool(message.content) ? { type: "running" } : message.status;
    const previous = output[output.length - 1];
    if (previous?.role !== "assistant" || custom.extensionNode || previous?.metadata?.custom?.extensionNode) {
      releaseNotices();
      output.push({ ...message, status: ownStatus, metadata: { ...message.metadata, custom: { ...custom, ...(turnStartedAt ? { turnStartedAt } : {}), ...(answerAt ? { answerAt } : {}) } } });
      continue;
    }
    const previousCustom = previous.metadata?.custom || {};
    const content = [...previous.content, ...message.content].filter((part) => !(part?.type === "text" && !safeText(part.text)));
    output[output.length - 1] = {
      ...previous,
      content: content.length ? content : [{ type: "text", text: "" }],
      status: mergedStatus(previous.status, ownStatus),
      metadata: {
        ...previous.metadata,
        custom: {
          ...previousCustom,
          ...custom,
          copyText: [typeof previousCustom.copyText === "string" ? previousCustom.copyText : contentText(previous.content.filter((part) => part.type === "text")), typeof custom.copyText === "string" ? custom.copyText : contentText(message.content.filter((part) => part.type === "text"))].filter(Boolean).join("\n"),
          toolOnly: false,
          toolUse: Boolean(custom.toolUse),
          live: Boolean(previousCustom.live || custom.live),
          ...(previousCustom.turnStartedAt ? { turnStartedAt: previousCustom.turnStartedAt } : {}),
          ...((answerAt || previousCustom.answerAt) ? { answerAt: answerAt || previousCustom.answerAt } : {}),
        },
      },
    };
  }
  releaseNotices();
  return output;
}
