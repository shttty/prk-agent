import { isRecord } from "../../../workbench/payloads/is-record.js";
import { parsePeerMessages } from "../../../../shared/session-messages/parse-peer-messages.js";
import { trimDisplay } from "../messages/trim-display.js";
import { contentText } from "../content-text.js";
import { toolId } from "../tools/tool-id.js";
import { dateValue } from "../messages/date-value.js";
import { messageId } from "../messages/message-id.js";
import { sdkTimestamp } from "../messages/sdk-timestamp.js";
import { makeTextMessage } from "../messages/make-text-message.js";
import { messageCustom } from "../messages/message-custom.js";
import { extensionMessageRenderer } from "../messages/extension-message-renderer.js";
import { makeAssistantMessage } from "../messages/make-assistant-message.js";
import { toolPart } from "../tools/tool-part.js";
import { thinkingPart } from "../messages/thinking-part.js";
import { hiddenThinkingLabel } from "../messages/hidden-thinking-label.js";
import { historyEntries } from "./history-entries.js";
export function historicalMessages(state, runs, sessionId) {
  const messages = state.session.snapshot?.messages || [];
  const output = [];
  const { entriesByPosition, afterLive } = historyEntries(state);
  const appendEntries = (position) => { for (const entry of entriesByPosition.get(position) || []) output.push(entry); };
  const placedTools = new Set();
  const placeTool = (id, messageIndex) => {
    const key = `${sessionId}:${id}`;
    if (placedTools.has(key)) return;
    const record = runs.get(key);
    if (!record) return;
    placedTools.add(key);
    output.push(makeAssistantMessage([toolPart(record.call, record.result, record.run)], `tool-${id}`, dateValue(record.call?.createdAt, messageIndex), undefined, { toolOnly: true }));
  };
  // Latest final assistant reply entry before the current message: the fork point for "rerun in a new session".
  let lastReplyEntryId = state.session.snapshot?.historyForkBefore || null;
  for (const [index, message] of messages.entries()) {
    appendEntries(index);
    if (!isRecord(message)) continue;
    const entryId = state.session.snapshot?.messageEntryIds?.[index];
    const id = messageId(message, index, entryId);
    if (message.role === "custom" && message.customType === "gateway-internal-notification" && message.display === false) continue;
    if (message.role === "toolResult") {
      placeTool(toolId(message, `historical-result-${index}`), index);
      continue;
    }
    if (message.role === "user") {
      const text = contentText(message.content);
      const renderer = extensionMessageRenderer(state, index);
      const displayedText = renderer?.node ? "" : typeof renderer?.text === "string" ? renderer.text : text;
      const sdkCustom = messageCustom(message);
      if (renderer?.node) sdkCustom.extensionNode = renderer.node;
      const peers = parsePeerMessages(text);
      if (typeof entryId === "string") Object.assign(sdkCustom, { entryId, entrySessionId: state.session.snapshot.sessionId });
      if (!peers && typeof entryId === "string") {
        Object.assign(sdkCustom, { rerunText: text, ...(lastReplyEntryId ? { forkBeforeEntryId: lastReplyEntryId } : {}) });
      }
      // One SDK envelope projects to the existing peer row for each member, without visual grouping.
      for (const [position, entry] of (peers ?? [{ body: displayedText }]).entries()) {
        const { body, ...peerMessage } = entry;
        const peerId = position === 0 ? id : `${id}:${position}`;
        output.push(makeTextMessage(trimDisplay(body), peerId, dateValue(message.createdAt, index), "user", { ...sdkCustom, copyText: peers ? body : text, ...(peers ? { peerMessage } : {}), ...sdkTimestamp(message) }));
      }
      continue;
    }
    if (message.role === "custom" && message.customType === "memory-notice") {
      output.push(makeTextMessage(contentText(message.content), id, dateValue(message.timestamp, index), "system", { memoryNotice: message.details }));
      continue;
    }
    if (message.role === "custom" && message.customType === "terminal-event") {
      output.push(makeTextMessage(contentText(message.content), id, dateValue(message.timestamp, index), "system", { terminalEvents: message.details?.events || [] }));
      continue;
    }
    if (message.role === "custom" && message.customType === "kernel-event") {
      if (message.details?.sessionId === sessionId) output.push(makeTextMessage("", messageId(message, index), dateValue(message.timestamp, index), "system", { kernelEvent: message.details }));
      continue;
    }
    if (message.role === "system" || message.role === "custom") {
      const renderer = extensionMessageRenderer(state, index);
      if (message.role === "custom" && message.display === false) continue;
      const text = renderer?.node ? "" : trimDisplay(typeof renderer?.text === "string" ? renderer.text : contentText(message.content));
      if (text || renderer?.node) output.push(makeTextMessage(text, id, dateValue(message.createdAt, index), "system", renderer?.node ? { extensionNode: renderer.node } : {}));
      continue;
    }
    if (message.role !== "assistant") continue;
    const parts = [];
    const content = message.content;
    const renderer = extensionMessageRenderer(state, index);
    let replacedText = false;
    for (const [partIndex, part] of content.entries()) {
      if (part.type === "toolCall") {
        const id = toolId(part, `historical-call-${index}-${partIndex}`);
        const key = `${sessionId}:${id}`;
        if (placedTools.has(key)) continue;
        const record = runs.get(key) || { call: part };
        parts.push(toolPart(record.call, record.result, record.run));
        placedTools.add(key);
      } else {
        if (renderer?.node) continue;
        if (part.type === "thinking") {
          const thinking = thinkingPart(part.thinking, hiddenThinkingLabel(state), part.redacted === true);
          if (thinking) parts.push(thinking);
          continue;
        }
        if (typeof renderer?.text === "string") {
          if (!replacedText && renderer.text) parts.push({ type: "text", text: trimDisplay(renderer.text) });
          replacedText = true;
        } else {
          const text = contentText(part);
          if (text) parts.push({ type: "text", text: trimDisplay(text) });
        }
      }
    }
    const sdkCustom = messageCustom(message);
    if (renderer?.node) sdkCustom.extensionNode = renderer.node;
    const copyText = contentText(content.filter((part) => part.type === "text"));
    if (copyText) sdkCustom.copyText = copyText;
    if (typeof entryId === "string" && message.stopReason !== "toolUse" && !content.some((part) => part.type === "toolCall") && copyText) {
      lastReplyEntryId = entryId;
      sdkCustom.forkEntryId = entryId;
      sdkCustom.forkSessionId = state.session.snapshot.sessionId;
    }
    if (parts.length || Object.keys(sdkCustom).length) output.push(makeAssistantMessage(parts, id, dateValue(message.createdAt, index), { type: "complete", reason: "stop" }, { ...sdkCustom, ...sdkTimestamp(message), ...(message.stopReason === "toolUse" ? { toolUse: true } : {}) }));
  }
  appendEntries(messages.length);
  return { output, placedTools, afterLive };
}
