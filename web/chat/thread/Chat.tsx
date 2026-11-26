import "./thread.css";
import { memo } from "react";
import { useMemo } from "react";
import { useRef } from "react";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import type { AppendMessage, ThreadMessage } from "@assistant-ui/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatState } from "./use-chat-state.ts";
import { useChatStore } from "./use-chat-store.ts";
import type { ChatActions } from "./chat-actions-types.ts";
import { threadMessages } from "../conversation/messages/thread-messages.ts";
import type { TranscriptMessage } from "../conversation/conversation-types.ts";
import type { BackgroundTask } from "../background-tasks/background-task-types.ts";
import { projectConversation } from "../conversation/project-conversation.ts";
import { reuseUnchangedMessages } from "../conversation/reuse-unchanged-messages.ts";
import { isBusy } from "../conversation/is-busy.ts";
import { contentText } from "../conversation/content-text.ts";
import { extensionUiInitializing } from "./extension-ui-initializing.ts";
import { ChatSurface } from "./ChatSurface.tsx";
/** Chat region: projects the selected session's conversation from the fields it selects and hosts the assistant-ui runtime. */
type ChatProps = { actions: ChatActions; onViewTerminal: (sessionId: string, task: BackgroundTask) => void };

function Chat({ actions, onViewTerminal }: ChatProps) {
  const store = useChatStore();
  const selectedSessionId = useChatState((state) => state.selectedSessionId);
  const streamId = useChatState((state) => state.session.streamId);
  const conversationMessages = useChatState((state) => state.session.snapshot?.messages);
  const conversationSessionId = useChatState((state) => state.session.snapshot?.sessionId);
  const conversationEntryIds = useChatState((state) => state.session.snapshot?.messageEntryIds);
  const conversationCompactions = useChatState((state) => state.session.snapshot?.compactions);
  const conversationHistoryBefore = useChatState((state) => state.session.snapshot?.historyBefore);
  const conversationHistoryForkBefore = useChatState((state) => state.session.snapshot?.historyForkBefore);
  const conversationNotifications = useChatState((state) => state.session.extensionUi?.notifications);
  const conversationHiddenThinkingLabel = useChatState((state) => state.session.extensionUi?.hiddenThinkingLabel);
  const conversationRenderEntries = useChatState((state) => state.session.extensionUiRender?.entries);
  const conversationRenderMessages = useChatState((state) => state.session.extensionUiRender?.messages);
  const conversationRenderStreaming = useChatState((state) => state.session.extensionUiRender?.streaming);
  const conversationRenderHiddenThinkingLabel = useChatState((state) => state.session.extensionUiRender?.hiddenThinkingLabel);
  const toolRuns = useChatState((state) => state.session.toolRuns);
  const toolContents = useChatState((state) => state.session.toolContents);
  const streams = useChatState((state) => state.session.streams);
  const operations = useChatState((state) => state.session.operations);
  const nativeFeedback = useChatState((state) => state.session.nativeFeedback);
  const running = useChatState(isBusy);
  const uiLoading = useChatState(extensionUiInitializing);
  const sending = useChatState((state) => state.session.pending.has("sending"));
  const readOnly = useChatState((state) => state.archive.some((group) => group.sessions.some((row) => row.sessionId === state.selectedSessionId)));
  // Last projection; equal messages keep their object so a stream delta re-renders only the live turn.
  const projected = useRef<TranscriptMessage[]>([]);
  const messages = useMemo(() => projected.current = reuseUnchangedMessages(projected.current, projectConversation({
    selectedSessionId,
    running,
    session: {
      streamId,
      snapshot: { messages: conversationMessages, sessionId: conversationSessionId, messageEntryIds: conversationEntryIds, compactions: conversationCompactions, historyBefore: conversationHistoryBefore, historyForkBefore: conversationHistoryForkBefore },
      extensionUi: { notifications: conversationNotifications, hiddenThinkingLabel: conversationHiddenThinkingLabel },
      extensionUiRender: { entries: conversationRenderEntries, messages: conversationRenderMessages, streaming: conversationRenderStreaming, hiddenThinkingLabel: conversationRenderHiddenThinkingLabel },
      toolRuns,
      toolContents,
      streams,
      operations,
      nativeFeedback,
    },
  })), [selectedSessionId, running, streamId, conversationMessages, conversationSessionId, conversationEntryIds, conversationCompactions, conversationHistoryBefore, conversationHistoryForkBefore, conversationNotifications, conversationHiddenThinkingLabel, conversationRenderEntries, conversationRenderMessages, conversationRenderStreaming, conversationRenderHiddenThinkingLabel, toolRuns, toolContents, streams, operations, nativeFeedback]);
  const adapter = useMemo(() => ({
    messages: threadMessages(messages),
    isRunning: running,
    isDisabled: readOnly || !selectedSessionId || uiLoading,
    isSendDisabled: readOnly || sending || !selectedSessionId || uiLoading,
    // Only the form submits from this UI; Input's native send shortcuts are off. Reads the store when called.
    onNew: async (message: AppendMessage) => {
      const text = contentText(message.content);
      const state = store.getSnapshot();
      if (!text.trim() || state.session.pending.has("sending") || !state.selectedSessionId || extensionUiInitializing(state) || readOnly) return;
      const admitted = await actions.sendMessage(text, { queue: state.queue || "steer", mode: "auto", attachments: state.attachments, references: state.references });
      if (!admitted) throw new Error("消息未发送。");
    },
    onCancel: async () => { await actions.cancelOperation(); },
    onRefetchThread: async () => { await actions.reconnect(); },
    unstable_capabilities: { copy: false },
  }), [actions, store, messages, running, selectedSessionId, uiLoading, sending, readOnly]);
  const runtime = useExternalStoreRuntime<ThreadMessage>(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSurface actions={actions} messageCount={messages.length} onViewTerminal={onViewTerminal} />
    </AssistantRuntimeProvider>
  );
}
export default memo(Chat);
