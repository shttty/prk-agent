import "../composer/composer.css";
import "../transcript/transcript.css";
import { useState } from "react";
import { useRef } from "react";
import { useMemo } from "react";
import { useCallback } from "react";
import { useLayoutEffect } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { Box } from "@mantine/core";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Loader } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { IconArrowDown } from "@tabler/icons-react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { ThreadPrimitive } from "@assistant-ui/react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { ExtensionRegion } from "../extension-ui/ExtensionRegion.jsx";
import { ExtensionToasts } from "../extension-ui/ExtensionToasts.jsx";
import { ExtensionUI } from "../extension-ui/ExtensionUI.jsx";
import { HistoryPagination } from "../transcript/HistoryPagination.jsx";
import { PresentationContext } from "../transcript/presentation-context.js";
import { MessageView } from "../transcript/MessageView.jsx";
import { usePresentationValue } from "../transcript/use-presentation-value.js";
import { lastOperationOutcome } from "../transcript/last-operation-outcome.js";
import { preserveDisclosure as preserveDisclosureBody } from "../transcript/preserve-disclosure.js";
import { anchorDisclosure as anchorDisclosureBody } from "../transcript/anchor-disclosure.js";
import { notifyTranscriptChange as notifyTranscriptChangeBody } from "../transcript/notify-transcript-change.js";
import { followTranscript as followTranscriptBody } from "../transcript/follow-transcript.js";
import { sessionHistoryLoading } from "./session-history-loading.js";
import { restoreScroll as restoreScrollBody } from "../transcript/restore-scroll.js";
import { saveScroll as saveScrollBody } from "../transcript/save-scroll.js";
import { noteScrollIntent as noteScrollIntentBody } from "../transcript/note-scroll-intent.js";
import { revealMessage as moveToMessage } from "../transcript/reveal-message.js";
import { revealKernelCell as moveToKernelCell } from "../transcript/tool-calls/kernel-cell/reveal-kernel-cell.js";
import { SearchMatchContext } from "../transcript/search-match-context.js";
import { useTranscriptSearch } from "../transcript/use-transcript-search.js";
import { TranscriptSearch } from "../transcript/TranscriptSearch.jsx";
import { PendingQueue } from "../composer/PendingQueue.jsx";
import { OperationBar } from "../composer/OperationBar.jsx";
import { ComposerDock } from "../composer/ComposerDock.jsx";
import { ComposerMeta } from "../composer/ComposerMeta.jsx";
import { SendStatus } from "../composer/SendStatus.jsx";
import { useBusy } from "../composer/use-busy.js";
import { useHistoryPagination } from "../transcript/use-history-pagination.js";
import { BackgroundTasks } from "../background-tasks/BackgroundTasks.jsx";
// Module-level so ThreadPrimitive.Messages keeps its memoized rows across surface renders.
const renderMessage = ({ message }) => <MessageView key={message.id} message={message} />;
const NO_PRESENTATION = { scrollTop: 0, anchor: null, openedTools: [] };
const DOCUMENT_INTENTS = ["keydown", "pointerup", "pointercancel"];
/**
 * The chat column: transcript (scroll restore/follow, search, plugin header/footer) and the composer row. It reads
 * only transcript fields; the composer row's parts subscribe to their own, so typing never re-renders it.
 */
export function ChatSurface({ actions, messageCount, onViewTerminal }) {
  const aui = useAui();
  const renderedMessageCount = useAuiState((value) => value.thread.messages.length);
  const hasSnapshot = useWorkbench((state) => Boolean(state.session.snapshot));
  const streamId = useWorkbench((state) => state.session.streamId);
  const presentationRevision = useWorkbench((state) => state.session.presentationRevision);
  const snapshotSessionId = useWorkbench((state) => state.session.snapshot?.sessionId);
  const transcriptRevision = useWorkbench((state) => state.session.transcriptRevision);
  const savedPresentation = useWorkbench((state) => state.presentation);
  const historyLoading = useWorkbench(sessionHistoryLoading);
  const archived = useWorkbench((state) => state.archive.some((group) => group.sessions.some((row) => row.sessionId === state.selectedSessionId)));
  const historyEnd = useWorkbench((state) => state.session.snapshot?.messageEntryIds?.at(-1));
  const operation = useWorkbench((state) => state.session.snapshot?.operation);
  const recentOperations = useWorkbench((state) => state.session.snapshot?.recentOperations);
  const { busy } = useBusy();
  const outcome = lastOperationOutcome({ operation, recentOperations }, busy);
  const [restoredPresentation, setRestoredPresentation] = useState(null);
  const scrollReady = hasSnapshot && restoredPresentation?.streamId === streamId && restoredPresentation?.revision === presentationRevision;
  const viewportRef = useRef(null);
  const messagesRef = useRef(null);
  const composerOverlaysRef = useRef(null);
  const restoringScrollRef = useRef(false);
  const restoredSessionRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const followRef = useRef(true);
  const [followOutput, setFollowOutput] = useState(true);
  const setFollowing = useCallback((next) => { followRef.current = next; setFollowOutput(next); }, []);
  const scrollIntentRef = useRef({ touchY: null, scrollbar: false });
  const disclosureRef = useRef(null);
  const [disclosureRevision, setDisclosureRevision] = useState(0);
  const [newMessages, setNewMessages] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const preserveDisclosure = useCallback((node) => { return preserveDisclosureBody({ viewportRef, disclosureRef, setDisclosureRevision, setFollowOutput: setFollowing }, node); }, [setFollowing]);
  const revealMessage = useCallback((id, options) => {
    const viewport = viewportRef.current;
    setFollowing(false);
    if (moveToMessage(viewport, id, options)) {
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
    }
  }, [setFollowing]);
  const revealKernelCell = useCallback((event, cell) => {
    moveToKernelCell(event, cell, aui.thread().getState().messages, revealMessage);
  }, [aui, revealMessage]);
  const presentationValue = usePresentationValue({ actions, preserveDisclosure, revealKernelCell });
  useLayoutEffect(() => { return anchorDisclosureBody({ disclosureRef, viewportRef, lastScrollTopRef, setAwayFromBottom }); }, [disclosureRevision]);
  const history = useHistoryPagination({ actions, viewportRef, restoringScrollRef, lastScrollTopRef, setFollowing, setAwayFromBottom, scrollReady, messageCount, renderedMessageCount });
  const { loadMore, page: { error: historyError } } = history;
  const loadAtTop = useCallback((viewport) => {
    if (viewport && viewport.scrollTop <= 24 && !restoringScrollRef.current && !historyError) void loadMore();
  }, [historyError, loadMore]);
  const noteScrollIntent = useCallback((event) => noteScrollIntentBody({ viewportRef, intentRef: scrollIntentRef, setFollowOutput: setFollowing, onUpAtTop: loadAtTop }, event), [setFollowing, loadAtTop]);
  // Keyboard scrolling can start with focus on the page body; a scrollbar drag can end outside the viewport.
  useEffect(() => {
    for (const type of DOCUMENT_INTENTS) document.addEventListener(type, noteScrollIntent, true);
    return () => { for (const type of DOCUMENT_INTENTS) document.removeEventListener(type, noteScrollIntent, true); };
  }, [noteScrollIntent]);
  const presentation = useMemo(() => savedPresentation || NO_PRESENTATION, [savedPresentation]);
  const searchModel = useTranscriptSearch({ actions, revealMessage, setFollowing, viewportRef, streamId, sessionId: snapshotSessionId, historyEnd, historyRevision: history.revision });
  const { searchOpen, open: findCurrentPage, searchMatches, searchIndex } = searchModel;
  const notifyTranscriptChange = useEffectEvent(() => { return notifyTranscriptChangeBody({ scrollReady, hasSnapshot, followRef, searchOpen, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision }); });
  useLayoutEffect(() => { notifyTranscriptChange(); }, [streamId, transcriptRevision, renderedMessageCount]);
  const restoreScroll = useEffectEvent(() => { return restoreScrollBody({ viewportRef, revealMessage: moveToMessage, hasSnapshot, sessionId: snapshotSessionId, restoredSessionRef, followRef, streamId, presentationRevision, savedPresentation, scrollReady, renderedMessageCount, messageCount, restoringScrollRef, lastScrollTopRef, presentation, setFollowOutput: setFollowing, setRestoredPresentation, setAwayFromBottom }); });
  useLayoutEffect(() => restoreScroll(), [messageCount, renderedMessageCount, scrollReady, streamId, presentationRevision, snapshotSessionId]);
  useLayoutEffect(() => followTranscriptBody({ viewportRef, messagesRef, composerOverlays: composerOverlaysRef.current, scrollReady, followRef, searchOpen, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages }), [scrollReady, followOutput, searchOpen]);
  useLayoutEffect(() => () => actions.flushScroll(), [actions]);
  const saveScroll = useCallback((event) => { return saveScrollBody({ scrollReady, restoringScrollRef, disclosureRef, lastScrollTopRef, followRef, intentRef: scrollIntentRef, setFollowOutput: setFollowing, setAwayFromBottom, setNewMessages, actions }, event); }, [actions, scrollReady, setFollowing]);
  // Sending or clicking Jump-to-bottom follows the transcript to the end, including incoming SDK bubbles.
  const followLatest = useCallback(() => {
    setFollowing(true);
    setNewMessages(false);
    setAwayFromBottom(false);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      lastScrollTopRef.current = viewport.scrollTop;
    }
  }, [setFollowing]);
  return (
    <PresentationContext.Provider value={presentationValue}>
      <Box className="pi-chat">
        <ThreadPrimitive.Root className="pi-thread">
          <ExtensionRegion actions={actions} placement="header" />
          <ExtensionToasts />
          <TranscriptSearch model={searchModel} />
          <div id="transcript" ref={viewportRef} className="pi-transcript transcript" onScroll={(event) => { saveScroll(event); loadAtTop(event.currentTarget); }}
            onWheel={noteScrollIntent} onTouchStart={noteScrollIntent} onTouchMove={noteScrollIntent} onPointerDown={noteScrollIntent}>
            <Stack id="messages" ref={messagesRef} className="pi-messages messages" gap={8}>
              {history.showPager ? <HistoryPagination page={history.page} loadMore={loadMore} /> : null}
              <SearchMatchContext.Provider value={searchMatches[searchIndex] ?? null}>
                <ThreadPrimitive.Messages>{renderMessage}</ThreadPrimitive.Messages>
              </SearchMatchContext.Provider>
              {outcome ? <InlineAlert className={`pi-operation-outcome${outcome.status === "cancelled" || outcome.status === "canceled" ? "" : " is-error"}`} color={outcome.status === "cancelled" || outcome.status === "canceled" ? "gray" : "red"} role="status" data-status={outcome.status}>{outcome.text}</InlineAlert> : null}
              <ThreadPrimitive.Empty>
                {historyLoading
                  ? <Group id="history-loading" className="pi-messages-empty messages-empty" justify="center" gap={8} c="dimmed"><Loader size="xs" color="gray" /><Text size="sm" c="dimmed">加载会话历史…</Text></Group>
                  : <Text className="pi-messages-empty messages-empty" c="dimmed" ta="center">想让它做点什么？</Text>}
              </ThreadPrimitive.Empty>
            </Stack>
          </div>
          <Box className="pi-composer-wrap">
            <div ref={composerOverlaysRef} className="pi-composer-overlays">
              {/* Not ThreadPrimitive.ScrollToBottom: its isAtBottom misses downward and restored scrolls. */}
              <Button id="new-messages" hidden={!awayFromBottom} data-kind={newMessages ? "new" : "away"} aria-label={newMessages ? undefined : "跳到底部"} className="pi-new-messages" size="compact-sm" variant="default" leftSection={<IconArrowDown size={19} stroke={2.6} />} onClick={followLatest}>{newMessages ? "有新消息 · 跳到最新" : null}</Button>
              {!archived && <>
                {snapshotSessionId && <BackgroundTasks key={snapshotSessionId} sessionId={snapshotSessionId} actions={actions} onViewTerminal={onViewTerminal} onRevealKernel={revealKernelCell} />}
                <OperationBar actions={actions} />
              </>}
            </div>
            {archived ? <Button id="find-current-page" size="compact-sm" variant="subtle" onClick={findCurrentPage}>查找已加载的历史</Button> : <>
              <PendingQueue actions={actions} />
              <ExtensionUI actions={actions} />
              <ComposerDock actions={actions} onFindInPage={findCurrentPage} onSend={followLatest} />
              <SendStatus />
              <ComposerMeta actions={actions} />
            </>}
          </Box>
          <ExtensionRegion actions={actions} placement="footer" />
        </ThreadPrimitive.Root>
      </Box>
    </PresentationContext.Provider>
  );
}
