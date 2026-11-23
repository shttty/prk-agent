import "./thread.css";
import { memo } from "react";
import { useContext } from "react";
import { useMemo } from "react";
import { useRef } from "react";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import { projectConversation } from "../conversation/project-conversation.js";
import { reuseUnchangedMessages } from "../conversation/reuse-unchanged-messages.js";
import { isBusy } from "../conversation/is-busy.js";
import { contentText } from "../conversation/content-text.js";
import { extensionUiInitializing } from "./extension-ui-initializing.js";
import { ChatSurface } from "./ChatSurface.jsx";
/** Chat region: projects the selected session's conversation from the fields it selects and hosts the assistant-ui runtime. */
function Chat({ actions, onViewTerminal }) {
  const store = useContext(WorkbenchContext);
  const selectedSessionId = useWorkbench((state) => state.selectedSessionId);
  const streamId = useWorkbench((state) => state.session.streamId);
  const conversationMessages = useWorkbench((state) => state.session.snapshot?.messages);
  const conversationSessionId = useWorkbench((state) => state.session.snapshot?.sessionId);
  const conversationEntryIds = useWorkbench((state) => state.session.snapshot?.messageEntryIds);
  const conversationCompactions = useWorkbench((state) => state.session.snapshot?.compactions);
  const conversationHistoryBefore = useWorkbench((state) => state.session.snapshot?.historyBefore);
  const conversationHistoryForkBefore = useWorkbench((state) => state.session.snapshot?.historyForkBefore);
  const conversationNotifications = useWorkbench((state) => state.session.extensionUi?.notifications);
  const conversationHiddenThinkingLabel = useWorkbench((state) => state.session.extensionUi?.hiddenThinkingLabel);
  const conversationRenderEntries = useWorkbench((state) => state.session.extensionUiRender?.entries);
  const conversationRenderMessages = useWorkbench((state) => state.session.extensionUiRender?.messages);
  const conversationRenderStreaming = useWorkbench((state) => state.session.extensionUiRender?.streaming);
  const conversationRenderHiddenThinkingLabel = useWorkbench((state) => state.session.extensionUiRender?.hiddenThinkingLabel);
  const toolRuns = useWorkbench((state) => state.session.toolRuns);
  const toolContents = useWorkbench((state) => state.session.toolContents);
  const streams = useWorkbench((state) => state.session.streams);
  const operations = useWorkbench((state) => state.session.operations);
  const nativeFeedback = useWorkbench((state) => state.session.nativeFeedback);
  const running = useWorkbench(isBusy);
  const uiLoading = useWorkbench(extensionUiInitializing);
  const sending = useWorkbench((state) => state.session.pending.has("sending"));
  const readOnly = useWorkbench((state) => state.archive.some((group) => group.sessions.some((row) => row.sessionId === state.selectedSessionId)));
  // Last projection; equal messages keep their object so a stream delta re-renders only the live turn.
  const projected = useRef([]);
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
    messages,
    isRunning: running,
    isDisabled: readOnly || !selectedSessionId || uiLoading,
    isSendDisabled: readOnly || sending || !selectedSessionId || uiLoading,
    // Only the form submits from this UI; Input's native send shortcuts are off. Reads the store when called.
    onNew: async (message) => {
      const text = contentText(message?.content);
      const state = store.getSnapshot();
      if (!text.trim() || state.session.pending.has("sending") || !state.selectedSessionId || extensionUiInitializing(state) || readOnly) return;
      const admitted = await actions.sendMessage(text, { queue: state.queue || "steer", mode: "auto", attachments: state.attachments, references: state.references });
      if (!admitted) throw new Error("消息未发送。");
    },
    onCancel: async () => { await actions.cancelOperation(); },
    onRefetchThread: async () => { await actions.reconnect(); },
    unstable_capabilities: { copy: false },
  }), [actions, store, messages, running, selectedSessionId, uiLoading, sending, readOnly]);
  const runtime = useExternalStoreRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSurface actions={actions} messageCount={messages.length} onViewTerminal={onViewTerminal} />
    </AssistantRuntimeProvider>
  );
}
export default memo(Chat);
