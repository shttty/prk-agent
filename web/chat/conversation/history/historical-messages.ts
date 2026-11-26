import { isPayload } from "../../payload/is-payload.ts";
import { parsePeerMessages } from "../../../../shared/session-messages/parse-peer-messages.ts";
import { trimDisplay } from "../messages/trim-display.ts";
import { contentText } from "../content-text.ts";
import { toolId } from "../tools/tool-id.ts";
import { dateValue } from "../messages/date-value.ts";
import { messageId } from "../messages/message-id.ts";
import { sdkTimestamp } from "../messages/sdk-timestamp.ts";
import { makeTextMessage } from "../messages/make-text-message.ts";
import { messageCustom } from "../messages/message-custom.ts";
import { extensionMessageRenderer } from "../messages/extension-message-renderer.ts";
import { makeAssistantMessage } from "../messages/make-assistant-message.ts";
import { toolPart } from "../tools/tool-part.ts";
import { thinkingPart } from "../messages/thinking-part.ts";
import { hiddenThinkingLabel } from "../messages/hidden-thinking-label.ts";
import { isKernelEvent } from "../messages/is-kernel-event.ts";
import { isMemoryNotice } from "../messages/is-memory-notice.ts";
import { isTerminalEvent } from "../messages/is-terminal-event.ts";
import type { ConversationState, MessagePart, ToolRecord, TranscriptMessage } from "../conversation-types.ts";
import { historyEntries } from "./history-entries.ts";
export function historicalMessages(state: ConversationState, runs: Map<string, ToolRecord>, sessionId: string) {
  const messages = state.session.snapshot?.messages || [];
  const output: TranscriptMessage[] = [];
  const { entriesByPosition, afterLive } = historyEntries(state);
  const appendEntries = (position: number) => { for (const entry of entriesByPosition.get(position) || []) output.push(entry); };
  const placedTools = new Set<string>();
  const placeTool = (id: string, messageIndex: number) => {
    const key = `${sessionId}:${id}`;
    if (placedTools.has(key)) return;
    const record = runs.get(key);
    if (!record) return;
    placedTools.add(key);
    output.push(makeAssistantMessage([toolPart(record.call, record.result, record.run)], `tool-${id}`, dateValue(record.call.createdAt, messageIndex), undefined, { toolOnly: true }));
  };
  // Latest final assistant reply entry before the current message: the fork point for "rerun in a new session".
  let lastReplyEntryId = state.session.snapshot?.historyForkBefore || null;
  for (const [index, message] of messages.entries()) {
    appendEntries(index);
    if (!isPayload(message)) continue;
    const entryId = state.session.snapshot?.messageEntryIds?.[index] ?? undefined;
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
      if (typeof entryId === "string") Object.assign(sdkCustom, { entryId, entrySessionId: state.session.snapshot?.sessionId });
      if (!peers && typeof entryId === "string") {
        Object.assign(sdkCustom, { rerunText: text, ...(lastReplyEntryId ? { forkBeforeEntryId: lastReplyEntryId } : {}) });
      }
      // One SDK envelope projects to the existing peer row for each member, without visual grouping.
      const members = peers ? peers.map(({ body, ...peerMessage }) => ({ body, peerMessage })) : [{ body: displayedText, peerMessage: undefined }];
      for (const [position, { body, peerMessage }] of members.entries()) {
        const peerId = position === 0 ? id : `${id}:${position}`;
        output.push(makeTextMessage(trimDisplay(body), peerId, dateValue(message.createdAt, index), "user", { ...sdkCustom, copyText: peers ? body : text, ...(peerMessage ? { peerMessage } : {}), ...sdkTimestamp(message) }));
      }
      continue;
    }
    if (message.role === "custom" && message.customType === "memory-notice") {
      output.push(makeTextMessage(contentText(message.content), id, dateValue(message.timestamp, index), "system", isMemoryNotice(message.details) ? { memoryNotice: message.details } : {}));
      continue;
    }
    if (message.role === "custom" && message.customType === "terminal-event") {
      const events = isPayload(message.details) && Array.isArray(message.details.events) ? message.details.events.filter(isTerminalEvent) : [];
      output.push(makeTextMessage(contentText(message.content), id, dateValue(message.timestamp, index), "system", { terminalEvents: events }));
      continue;
    }
    if (message.role === "custom" && message.customType === "kernel-event") {
      if (isPayload(message.details) && message.details.sessionId === sessionId && isKernelEvent(message.details)) output.push(makeTextMessage("", messageId(message, index), dateValue(message.timestamp, index), "system", { kernelEvent: message.details }));
      continue;
    }
    if (message.role === "system" || message.role === "custom") {
      const renderer = extensionMessageRenderer(state, index);
      if (message.role === "custom" && message.display === false) continue;
      const text = renderer?.node ? "" : trimDisplay(typeof renderer?.text === "string" ? renderer.text : contentText(message.content));
      if (text || renderer?.node) output.push(makeTextMessage(text, id, dateValue(message.createdAt, index), "system", renderer?.node ? { extensionNode: renderer.node } : {}));
      continue;
    }
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    const parts: MessagePart[] = [];
    const content = message.content.filter(isPayload);
    const renderer = extensionMessageRenderer(state, index);
    let replacedText = false;
    for (const [partIndex, part] of content.entries()) {
      if (part.type === "toolCall") {
        const id = toolId(part, `historical-call-${index}-${partIndex}`);
        const key = `${sessionId}:${id}`;
        if (placedTools.has(key)) continue;
        const record: ToolRecord = runs.get(key) || { call: part };
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
      sdkCustom.forkSessionId = state.session.snapshot?.sessionId;
    }
    if (parts.length || Object.keys(sdkCustom).length) output.push(makeAssistantMessage(parts, id, dateValue(message.createdAt, index), { type: "complete", reason: "stop" }, { ...sdkCustom, ...sdkTimestamp(message), ...(message.stopReason === "toolUse" ? { toolUse: true } : {}) }));
  }
  appendEntries(messages.length);
  return { output, placedTools, afterLive };
}
