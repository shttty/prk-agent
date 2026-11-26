import "./messages/messages.css";
import { useCallback, useContext, useMemo } from "react";
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
import { MessageAttachments } from "./messages/MessageAttachments.jsx";
import { MarkdownPart } from "./messages/MarkdownPart.jsx";
import { UserMarkdownPart } from "./messages/UserMarkdownPart.jsx";
import { ToolPart } from "./tool-calls/ToolPart.jsx";
import { ThinkingPart } from "./reasoning/ThinkingPart.jsx";
import { TurnContext } from "./turns/turn-context.js";
import { transcriptVisibility } from "./transcript-visibility.js";
import { turnGrouping } from "./turns/turn-grouping.js";
import { TurnGroup } from "./turns/TurnGroup.jsx";
import { MessageActions } from "./messages/MessageActions.jsx";
import { PeerMessageHeader } from "./messages/peer/PeerMessageHeader.jsx";
import { PeerTextPart } from "./messages/peer/PeerTextPart.jsx";
import { PeerResultReport } from "./messages/peer/PeerResultReport.jsx";
import { PeerFailureReport } from "./messages/peer/PeerFailureReport.jsx";
import { projectPeerBody } from "./messages/peer/project-peer-body.js";
import { SearchMatchContext } from "./search-match-context.js";
const NO_CUSTOM = {};
const HiddenPart = () => null;
const PEER_OUTCOME = { result: "已交付结果", failure: "运行失败" };
export function MessageView({ message }) {
  const presentationContext = useContext(PresentationContext);
  const actions = presentationContext?.actions;
  const matchClass = useContext(SearchMatchContext) === message.id ? " pi-search-match" : "";
  const custom = message?.metadata?.custom ?? NO_CUSTOM;
  const peer = message?.role === "user" ? custom.peerMessage : null;
  const completionFailed = ["failed", "unknown"].includes(safeText(custom.completionStatus));
  const status = message?.role === "assistant" && message.status?.type === "incomplete"
    ? "生成未完成，请检查当前状态。"
    : message?.role === "assistant" && message.status?.type === "running" ? "正在生成…" : "";
  const display = presentationContext?.transcriptDisplay;
  const { showText, showThinking } = transcriptVisibility(message, display);
  // Copy text keeps the full peer body; the displayed part may be truncated.
  const report = useMemo(() => peer ? projectPeerBody(custom.copyText) : null, [peer, custom.copyText]);
  const textComponent = message.role === "user" ? peer ? PeerTextPart : UserMarkdownPart : showText ? MarkdownPart : HiddenPart;
  const streaming = message?.role === "assistant" && message.status?.type === "running";
  const foldMode = display?.turnFoldMode;
  const groupParts = useCallback((parts) => turnGrouping(parts, !streaming, foldMode, { showThinking, showText }), [streaming, foldMode, showThinking, showText]);
  // assistant-ui appends an empty running assistant when the last row is not an assistant; a notice
  // rendered after a turn that is still running must not add a second "generating" row.
  const duplicatePlaceholder = useAuiState((value) => Boolean(message?.metadata?.isOptimistic) && value.thread.messages.some((item) => item.role === "assistant" && !item.metadata?.isOptimistic && item.status?.type === "running"));
  if (duplicatePlaceholder) return null;
  if (custom.compaction) return <MessagePrimitive.Root className={`message-row pi-message pi-message-system pi-history-compaction system${matchClass}`} data-message-id={message.id} data-entry-id={custom.compaction.entryId} data-first-kept-entry-id={custom.compaction.firstKeptEntryId}>
    <details>
      <summary onClick={(event) => presentationContext?.preserveDisclosure?.(event.currentTarget.parentElement)}>以上已压缩，模型只看到摘要 · 查看摘要</summary>
      <pre>{custom.compaction.summary}</pre>
    </details>
  </MessagePrimitive.Root>;
  if (custom.memoryNotice) return <MessagePrimitive.Root className={`message-row pi-message pi-message-system system${matchClass}`} data-message-id={message.id}>
    <MemoryNotice notice={custom.memoryNotice} />
  </MessagePrimitive.Root>;
  if (custom.terminalEvents) return <MessagePrimitive.Root className={`message-row pi-message pi-message-system system${matchClass}`} data-message-id={message.id}>
    {custom.terminalEvents.map((event, index) => <NoteAccordion key={index} className="pi-terminal-event" data-kind={event.kind} data-terminal={event.result.name} title={`终端 ${event.result.name}：${event.kind === "quiet" ? `安静了 ${Math.round(event.quiet_ms / 1000)}s` : event.kind === "exit" ? "shell 已退出" : event.result.status === "killed" ? "命令已终止" : `命令结束 exit ${event.result.exit_code}`}`}>
      <Code block className="pi-terminal-event-json">{JSON.stringify(event.result, null, 2)}</Code>
    </NoteAccordion>)}
  </MessagePrimitive.Root>;
  if (custom.kernelEvent) return <MessagePrimitive.Root className={`message-row pi-message pi-message-system system${matchClass}`} data-message-id={message.id}>
    <Text component="a" size="xs" c="dimmed" href={`#kernel-cell-${custom.kernelEvent.cellId}`} data-kind="kernel-event" data-event-kind={custom.kernelEvent.kind} data-event-id={custom.kernelEvent.eventId} data-cell-id={custom.kernelEvent.cellId} data-tool-call-id={custom.kernelEvent.toolCallId} onClick={(event) => presentationContext?.revealKernelCell(event, custom.kernelEvent)}>
      {custom.kernelEvent.kind === "checkpoint" ? `运行提醒 ${custom.kernelEvent.step}` : `执行结束 · ${custom.kernelEvent.outcome}`}
    </Text>
  </MessagePrimitive.Root>;
  if (custom.extensionNotification) {
    const notification = custom.extensionNotification;
    return <MessagePrimitive.Root className={`message-row pi-message pi-message-system system${matchClass}`} data-message-id={message.id}>
      <Text size="xs" className={`extension-ui-notification is-${notification.type}`} data-notification-id={notification.id} data-notification-type={notification.type} role={notification.type === "error" ? "alert" : "status"}><AnsiText text={notification.message} /></Text>
    </MessagePrimitive.Root>;
  }
  return (
    <MessagePrimitive.Root
      className={`message-row pi-message pi-message-${message.role} ${message.role}${peer ? " pi-message-peer" : ""}${custom.nativeFeedback ? " pi-native-interaction-card" : ""}${streaming ? " is-streaming" : ""}${matchClass}`}
      data-message-id={message.id}
      data-text-buffered={!showText ? true : undefined}
      data-entry-id={message.role === "user" ? custom.entryId : undefined}
      aria-label={custom.nativeFeedback ? "原生操作结果" : peer ? "同伴消息" : message.role === "user" ? "你" : message.role === "assistant" ? "助手" : "系统记录"}
    >
      <Box className="message-body pi-message-body">
        {peer ? <PeerMessageHeader peer={peer} outcome={PEER_OUTCOME[report.kind]} /> : null}
        {report?.kind === "result" ? <PeerResultReport report={report} messageId={message.id} /> : null}
        {report?.kind === "failure" ? <PeerFailureReport report={report} /> : null}
        <TurnContext.Provider value={message}>
          {!custom.extensionNode && !PEER_OUTCOME[report?.kind] ? <MessagePrimitive.Unstable_PartsGrouped groupingFunction={groupParts} components={{ Text: textComponent, Reasoning: showThinking ? ThinkingPart : HiddenPart, tools: { Fallback: ToolPart }, Group: TurnGroup }} /> : null}
        </TurnContext.Provider>
        {custom.extensionNode ? <ExtensionNode node={custom.extensionNode} onAction={(args) => { if (presentationContext?.actions?.extensionUiAction) void presentationContext.actions.extensionUiAction("component", args); }} className="extension-message-renderer" /> : null}
        {!custom.extensionNode ? <>
        <MessageAttachments attachments={custom.attachments} messageId={message.id} showImages={presentationContext?.showImages !== false} />
        {Array.isArray(custom.references) && custom.references.length ? <Group className="pi-message-references" gap={4}>{custom.references.map((reference, index) => <Badge key={`${reference.type || "reference"}-${index}`} variant="outline" title={`${reference.target || ""} · ${reference.sessionId || ""}`}>{reference.source || "引用"}: {reference.name || reference.path || reference.text?.slice(0, 32) || reference.type}</Badge>)}</Group> : null}
        </> : null}
        {status ? <Text className={`message-status pi-message-status${status.includes("未知") || completionFailed ? " is-error" : ""}`} size="xs">{status}</Text> : null}
      </Box>
      {message.role === "user" || (message.role === "assistant" && showText && !custom.nativeFeedback) ? <MessageActions role={message.role} custom={custom} content={message.content} actions={actions} /> : null}
    </MessagePrimitive.Root>
  );
}
