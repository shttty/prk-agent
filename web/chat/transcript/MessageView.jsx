import "./messages/messages.css";
import { useContext } from "react";
import { Code } from "@mantine/core";
import { Text } from "@mantine/core";
import { Box } from "@mantine/core";
import { Group } from "@mantine/core";
import { Badge } from "@mantine/core";
import NoteAccordion from "../../design-system/note-accordion/NoteAccordion.jsx";
import { useAuiState } from "@assistant-ui/react";
import { MessagePrimitive } from "@assistant-ui/react";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { ExtensionNode } from "../extension-ui/ExtensionNode.jsx";
import { AnsiText } from "../ansi/AnsiText.jsx";
import { MemoryNotice } from "../memory-notice/MemoryNotice.jsx";
import { PresentationContext } from "./presentation-context.js";
import { MarkdownPart } from "./messages/MarkdownPart.jsx";
import { UserMarkdownPart } from "./messages/UserMarkdownPart.jsx";
import { ToolPart } from "./tool-calls/ToolPart.jsx";
import { ThinkingPart } from "./reasoning/ThinkingPart.jsx";
import { TurnContext } from "./turns/turn-context.js";
import { finishedTurnGrouping } from "./turns/turn-grouping.js";
import { runningTurnGrouping } from "./turns/turn-grouping.js";
import { TurnGroup } from "./turns/TurnGroup.jsx";
import { MessageActions } from "./messages/MessageActions.jsx";
import { PeerMessageHeader } from "./messages/PeerMessageHeader.jsx";
import { revealKernelCell } from "./tool-calls/kernel-cell/reveal-kernel-cell.js";
const NO_CUSTOM = {};
export function MessageView({ message }) {
  const presentationContext = useContext(PresentationContext);
  const actions = presentationContext?.actions;
  const custom = message?.metadata?.custom ?? NO_CUSTOM;
  const peer = message?.role === "user" ? custom.peerMessage : null;
  const completionFailed = ["failed", "unknown"].includes(safeText(custom.completionStatus));
  const status = message?.role === "assistant" && message.status?.type === "incomplete"
    ? "生成未完成，请检查当前状态。"
    : message?.role === "assistant" && message.status?.type === "running" ? "正在生成…" : "";
  const textComponent = message?.role === "user" ? UserMarkdownPart : MarkdownPart;
  const streaming = message?.role === "assistant" && message.status?.type === "running";
  const batch = peer?.batch && Number.isSafeInteger(peer.batch.count) && peer.batch.count > 1 ? peer.batch : null;
  const batchClass = batch
    ? ` pi-peer-batch${batch.index === 0 ? " is-batch-first" : ""}${batch.index === batch.count - 1 ? " is-batch-last" : ""}`
    : "";
  // assistant-ui appends an empty running assistant when the last row is not an assistant; a notice
  // rendered after a turn that is still running must not add a second "generating" row.
  const duplicatePlaceholder = useAuiState((value) => Boolean(message?.metadata?.isOptimistic) && value.thread.messages.some((item) => item.role === "assistant" && !item.metadata?.isOptimistic && item.status?.type === "running"));
  if (duplicatePlaceholder) return null;
  if (custom.compaction) return <MessagePrimitive.Root className="message-row pi-message pi-message-system pi-history-compaction system" data-message-id={message.id} data-entry-id={custom.compaction.entryId} data-first-kept-entry-id={custom.compaction.firstKeptEntryId}>
    <details>
      <summary onClick={(event) => presentationContext?.preserveDisclosure?.(event.currentTarget.parentElement)}>以上已压缩，模型只看到摘要 · 查看摘要</summary>
      <pre>{custom.compaction.summary}</pre>
    </details>
  </MessagePrimitive.Root>;
  if (custom.memoryNotice) return <MessagePrimitive.Root className="message-row pi-message pi-message-system system" data-message-id={message.id}>
    <MemoryNotice notice={custom.memoryNotice} />
  </MessagePrimitive.Root>;
  if (custom.terminalEvents) return <MessagePrimitive.Root className="message-row pi-message pi-message-system system" data-message-id={message.id}>
    {custom.terminalEvents.map((event, index) => <NoteAccordion key={index} className="pi-terminal-event" data-kind={event.kind} data-terminal={event.result.name} title={`终端 ${event.result.name}：${event.kind === "quiet" ? `安静了 ${Math.round(event.quiet_ms / 1000)}s` : event.kind === "exit" ? "shell 已退出" : event.result.status === "killed" ? "命令已终止" : `命令结束 exit ${event.result.exit_code}`}`}>
      <Code block className="pi-terminal-event-json">{JSON.stringify(event.result, null, 2)}</Code>
    </NoteAccordion>)}
  </MessagePrimitive.Root>;
  if (custom.kernelEvent) return <MessagePrimitive.Root className="message-row pi-message pi-message-system system" data-message-id={message.id}>
    <Text component="a" size="xs" c="dimmed" href={`#kernel-cell-${custom.kernelEvent.cellId}`} data-kind="kernel-event" data-event-kind={custom.kernelEvent.kind} data-event-id={custom.kernelEvent.eventId} data-cell-id={custom.kernelEvent.cellId} data-tool-call-id={custom.kernelEvent.toolCallId} onClick={(event) => revealKernelCell(event, custom.kernelEvent)}>
      {custom.kernelEvent.kind === "checkpoint" ? `运行提醒 ${custom.kernelEvent.step}` : `执行结束 · ${custom.kernelEvent.outcome}`}
    </Text>
  </MessagePrimitive.Root>;
  if (custom.extensionNotification) {
    const notification = custom.extensionNotification;
    return <MessagePrimitive.Root className="message-row pi-message pi-message-system system" data-message-id={message.id}>
      <Text size="xs" className={`extension-ui-notification is-${notification.type}`} data-notification-id={notification.id} data-notification-type={notification.type} role={notification.type === "error" ? "alert" : "status"}><AnsiText text={notification.message} /></Text>
    </MessagePrimitive.Root>;
  }
  return (
    <MessagePrimitive.Root
      className={`message-row pi-message pi-message-${message.role} ${message.role}${peer ? " pi-message-peer" : ""}${batchClass}${custom.nativeFeedback ? " pi-native-interaction-card" : ""}${streaming ? " is-streaming" : ""}`}
      data-message-id={message.id}
      data-entry-id={message.role === "user" ? custom.entryId : undefined}
      aria-label={custom.nativeFeedback ? "原生操作结果" : peer ? "同伴消息" : message.role === "user" ? "你" : message.role === "assistant" ? "助手" : "系统记录"}
    >
      {batch?.index === 0 ? <Text component="div" className="pi-peer-batch-caption" size="xs">{batch.count} 条同伴消息 · 一起送达</Text> : null}
      <Box className="message-body pi-message-body">
        {peer ? <PeerMessageHeader peer={peer} /> : null}
        <TurnContext.Provider value={message}>
          {!custom.extensionNode ? <MessagePrimitive.Unstable_PartsGrouped groupingFunction={streaming ? runningTurnGrouping : finishedTurnGrouping} components={{ Text: textComponent, Reasoning: ThinkingPart, tools: { Fallback: ToolPart }, Group: TurnGroup }} /> : null}
        </TurnContext.Provider>
        {custom.extensionNode ? <ExtensionNode node={custom.extensionNode} onAction={(args) => { if (presentationContext?.actions?.extensionUiAction) void presentationContext.actions.extensionUiAction("component", args); }} className="extension-message-renderer" /> : null}
        {!custom.extensionNode ? <>
        {Array.isArray(custom.attachments) && custom.attachments.length ? <Group className="pi-message-attachments" gap={4}>{custom.attachments.map((attachment, index) => <Box key={`${attachment.name || "attachment"}-${index}`} className="pi-message-attachment"><Badge variant="light" color={attachment.type?.startsWith("image/") ? "violet" : "gray"}>{attachment.source || "browser"}: {attachment.name || "附件"} · {attachment.size || 0} B</Badge>{presentationContext?.showImages !== false && attachment.type?.startsWith("image/") && typeof attachment.data === "string" ? <img src={`data:${attachment.type};base64,${attachment.data}`} alt={attachment.name || "上传图片"} loading="lazy" /> : null}</Box>)}</Group> : null}
        {Array.isArray(custom.references) && custom.references.length ? <Group className="pi-message-references" gap={4}>{custom.references.map((reference, index) => <Badge key={`${reference.type || "reference"}-${index}`} variant="outline" title={`${reference.target || ""} · ${reference.sessionId || ""}`}>{reference.source || "引用"}: {reference.name || reference.path || reference.text?.slice(0, 32) || reference.type}</Badge>)}</Group> : null}
        </> : null}
        {status ? <Text className={`message-status pi-message-status${status.includes("未知") || completionFailed ? " is-error" : ""}`} size="xs">{status}</Text> : null}
      </Box>
      {message.role === "user" || (message.role === "assistant" && !custom.nativeFeedback) ? <MessageActions role={message.role} custom={custom} content={message.content} actions={actions} /> : null}
    </MessagePrimitive.Root>
  );
}
