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
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { IconArrowDown } from "@tabler/icons-react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { ThreadPrimitive } from "@assistant-ui/react";
import { useChatState } from "./use-chat-state.ts";
import { ExtensionRegion } from "../extension-ui/ExtensionRegion.tsx";
import { ExtensionToasts } from "../extension-ui/ExtensionToasts.tsx";
import { ExtensionUI } from "../extension-ui/ExtensionUI.tsx";
import { ImageViewerProvider } from "../transcript/image-viewer/ImageViewerProvider.tsx";
import { TranscriptList } from "../transcript/TranscriptList.tsx";
import { PresentationContext } from "../transcript/presentation-context.ts";
import { usePresentationValue } from "../transcript/use-presentation-value.ts";
import { lastOperationOutcome } from "../transcript/last-operation-outcome.ts";
import { preserveDisclosure as preserveDisclosureBody } from "../transcript/preserve-disclosure.ts";
import { anchorDisclosure as anchorDisclosureBody } from "../transcript/anchor-disclosure.ts";
import { notifyTranscriptChange as notifyTranscriptChangeBody } from "../transcript/notify-transcript-change.ts";
import { followTranscript as followTranscriptBody } from "../transcript/follow-transcript.ts";
import { sessionHistoryLoading } from "./session-history-loading.ts";
import { restoreScroll as restoreScrollBody } from "../transcript/restore-scroll.ts";
import { saveScroll as saveScrollBody } from "../transcript/save-scroll.ts";
import { noteScrollIntent as noteScrollIntentBody } from "../transcript/note-scroll-intent.ts";
import { revealKernelCell as moveToKernelCell } from "../transcript/tool-calls/kernel-cell/reveal-kernel-cell.ts";
import { SearchMatchContext } from "../transcript/search-match-context.ts";
import { useTranscriptSearch } from "../transcript/use-transcript-search.ts";
import { TranscriptSearch } from "../transcript/TranscriptSearch.tsx";
import { PendingQueue } from "../composer/PendingQueue.tsx";
import { OperationBar } from "../composer/OperationBar.tsx";
import { ComposerDock } from "../composer/ComposerDock.tsx";
import { ModelCatalogAlert } from "../composer/meta/ModelCatalogAlert.tsx";
import { SendStatus } from "../composer/SendStatus.tsx";
import { useBusy } from "../composer/use-busy.ts";
import { useHistoryPagination } from "../transcript/use-history-pagination.ts";
import type { UIEvent } from "react";
import type { ChatActions } from "./chat-actions-types.ts";
import type { BackgroundTask } from "../background-tasks/background-task-types.ts";
import type { KernelEvent } from "../conversation/conversation-types.ts";
import type { PendingDisclosure, RestoredPresentation, RevealOptions, ScrollIntent, TranscriptListHandle } from "../transcript/scroll-types.ts";
import { projectedMessage } from "../conversation/messages/projected-message.ts";
import { BackgroundTasks } from "../background-tasks/BackgroundTasks.tsx";
const NO_PRESENTATION = { scrollTop: 0, anchor: null, openedTools: [] };
const DOCUMENT_INTENTS = ["keydown", "pointerup", "pointercancel"];
/**
 * The chat column: transcript (scroll restore/follow, search, plugin header/footer) and the composer row. It reads
 * only transcript fields; the composer row's parts subscribe to their own, so typing never re-renders it.
 */
type ChatSurfaceProps = { actions: ChatActions; messageCount: number; onViewTerminal: (sessionId: string, task: BackgroundTask) => void };

export function ChatSurface({ actions, messageCount, onViewTerminal }: ChatSurfaceProps) {
  const aui = useAui();
  const renderedMessageCount = useAuiState((value) => value.thread.messages.length);
  const hasSnapshot = useChatState((state) => Boolean(state.session.snapshot));
  const streamId = useChatState((state) => state.session.streamId);
  const presentationRevision = useChatState((state) => state.session.presentationRevision);
  const snapshotSessionId = useChatState((state) => state.session.snapshot?.sessionId);
  const transcriptRevision = useChatState((state) => state.session.transcriptRevision);
  const savedPresentation = useChatState((state) => state.presentation);
  const historyLoading = useChatState(sessionHistoryLoading);
  const archived = useChatState((state) => state.archive.some((group) => group.sessions.some((row) => row.sessionId === state.selectedSessionId)));
  const historyEnd = useChatState((state) => state.session.snapshot?.messageEntryIds?.at(-1));
  const operation = useChatState((state) => state.session.snapshot?.operation);
  const recentOperations = useChatState((state) => state.session.snapshot?.recentOperations);
  const { busy } = useBusy();
  const outcome = lastOperationOutcome({ operation, recentOperations }, busy);
  const [restoredPresentation, setRestoredPresentation] = useState<RestoredPresentation | null>(null);
  const scrollReady = hasSnapshot && restoredPresentation?.streamId === streamId && restoredPresentation?.revision === presentationRevision;
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<TranscriptListHandle>(null);
  const pin = useCallback(() => listRef.current?.pin(), []);
  const scrollTo = useCallback((offset: number) => listRef.current?.scrollTo(offset), []);
  const beforePrepend = useCallback(() => listRef.current?.beforePrepend(), []);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerOverlaysRef = useRef<HTMLDivElement>(null);
  const restoringScrollRef = useRef(false);
  const restoredSessionRef = useRef<string | null>(null);
  const lastScrollTopRef = useRef(0);
  const followRef = useRef(true);
  const [followOutput, setFollowOutput] = useState(true);
  const setFollowing = useCallback((next: boolean) => { followRef.current = next; setFollowOutput(next); }, []);
  const scrollIntentRef = useRef<ScrollIntent>({ touchY: null, scrollbar: false });
  const disclosureRef = useRef<PendingDisclosure | null>(null);
  const [disclosureRevision, setDisclosureRevision] = useState(0);
  const [newMessages, setNewMessages] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const preserveDisclosure = useCallback((node: Element | null) => { return preserveDisclosureBody({ viewportRef, disclosureRef, setDisclosureRevision, setFollowOutput: setFollowing }, node); }, [setFollowing]);
  const revealMessage = useCallback((id: string, options?: RevealOptions) => {
    const viewport = viewportRef.current;
    setFollowing(false);
    listRef.current?.revealMessage(id, { ...options, onReveal: () => {
      if (!viewport) return;
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
    } });
    if (viewport) lastScrollTopRef.current = viewport.scrollTop;
  }, [setFollowing]);
  const revealKernelCell = useCallback((event: { preventDefault: () => void }, cell: KernelEvent) => {
    moveToKernelCell(event, cell, aui.thread().getState().messages.map(projectedMessage), revealMessage);
  }, [aui, revealMessage]);
  const presentationValue = usePresentationValue({ actions, preserveDisclosure, revealKernelCell });
  useLayoutEffect(() => { return anchorDisclosureBody({ scrollTo, disclosureRef, viewportRef, lastScrollTopRef, setAwayFromBottom }); }, [disclosureRevision, scrollTo]);
  const history = useHistoryPagination({ actions, beforePrepend, setFollowing, scrollReady });
  const { loadMore, page: { error: historyError } } = history;
  const loadAtTop = useCallback((viewport: HTMLElement) => {
    if (viewport && viewport.scrollTop <= 24 && !restoringScrollRef.current && !historyError) void loadMore();
  }, [historyError, loadMore]);
  const noteScrollIntent = useCallback((event: Event | UIEvent) => noteScrollIntentBody({ viewportRef, intentRef: scrollIntentRef, setFollowOutput: setFollowing, onUpAtTop: loadAtTop }, event), [setFollowing, loadAtTop]);
  // Keyboard scrolling can start with focus on the page body; a scrollbar drag can end outside the viewport.
  useEffect(() => {
    for (const type of DOCUMENT_INTENTS) document.addEventListener(type, noteScrollIntent, true);
    return () => { for (const type of DOCUMENT_INTENTS) document.removeEventListener(type, noteScrollIntent, true); };
  }, [noteScrollIntent]);
  const presentation = useMemo(() => savedPresentation || NO_PRESENTATION, [savedPresentation]);
  const searchModel = useTranscriptSearch({ actions, revealMessage, setFollowing, viewportRef, streamId, sessionId: snapshotSessionId, historyEnd, historyRevision: history.revision });
  const { searchOpen, open: findCurrentPage, searchMatches, searchIndex } = searchModel;
  const mayFollow = useCallback(() => scrollReady && followRef.current && !searchOpen && !disclosureRef.current, [scrollReady, searchOpen]);
  const notifyTranscriptChange = useEffectEvent(() => { return notifyTranscriptChangeBody({ pin, scrollReady, hasSnapshot, followRef, searchOpen, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision }); });
  useLayoutEffect(() => { notifyTranscriptChange(); }, [streamId, transcriptRevision, renderedMessageCount]);
  const restoreScroll = useEffectEvent(() => { return restoreScrollBody({ viewportRef, listRef, hasSnapshot, sessionId: snapshotSessionId, restoredSessionRef, followRef, streamId, presentationRevision, savedPresentation, scrollReady, renderedMessageCount, messageCount, restoringScrollRef, lastScrollTopRef, presentation, setFollowOutput: setFollowing, setRestoredPresentation, setAwayFromBottom }); });
  useLayoutEffect(() => restoreScroll(), [messageCount, renderedMessageCount, scrollReady, streamId, presentationRevision, snapshotSessionId]);
  useLayoutEffect(() => followTranscriptBody({ pin, viewportRef, messagesRef, composerOverlays: composerOverlaysRef.current, scrollReady, followRef, searchOpen, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages }), [pin, scrollReady, followOutput, searchOpen]);
  useLayoutEffect(() => () => actions.flushScroll(), [actions]);
  const saveScroll = useCallback((event: UIEvent<HTMLElement>) => { return saveScrollBody({ scrollReady, restoringScrollRef, disclosureRef, lastScrollTopRef, followRef, intentRef: scrollIntentRef, setFollowOutput: setFollowing, setAwayFromBottom, setNewMessages, actions }, event); }, [actions, scrollReady, setFollowing]);
  // Sending or clicking Jump-to-bottom follows the transcript to the end, including incoming SDK bubbles.
  const followLatest = useCallback(() => {
    setFollowing(true);
    setNewMessages(false);
    setAwayFromBottom(false);
    const viewport = viewportRef.current;
    if (viewport) {
      pin();
      lastScrollTopRef.current = viewport.scrollTop;
    }
  }, [pin, setFollowing]);
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
              <SearchMatchContext.Provider value={searchMatches[searchIndex] ?? null}>
                <ImageViewerProvider identity={`${snapshotSessionId}:${streamId}:${presentationRevision}`}>
                  <TranscriptList key={snapshotSessionId} ref={listRef} viewportRef={viewportRef} history={history} following={scrollReady && followOutput && !searchOpen} mayFollow={mayFollow} />
                </ImageViewerProvider>
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
              <SendStatus actions={actions} />
              <ModelCatalogAlert />
            </>}
          </Box>
          <ExtensionRegion actions={actions} placement="footer" />
        </ThreadPrimitive.Root>
      </Box>
    </PresentationContext.Provider>
  );
}
