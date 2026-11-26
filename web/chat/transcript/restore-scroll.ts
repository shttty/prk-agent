import type { RestoredPresentation, Presentation, ScrollRef, SetState, TranscriptListHandle, ViewportRef } from "./scroll-types.ts";

type RestoreScroll = {
  viewportRef: ViewportRef; listRef: ScrollRef<TranscriptListHandle | null>; hasSnapshot: boolean; sessionId: string | undefined; restoredSessionRef: ScrollRef<string | null | undefined>;
  followRef: ScrollRef<boolean>; streamId: string | null; presentationRevision: number; savedPresentation: Presentation | null; scrollReady: boolean;
  renderedMessageCount: number; messageCount: number; restoringScrollRef: ScrollRef<boolean>; lastScrollTopRef: ScrollRef<number>; presentation: Presentation;
  setFollowOutput: (follow: boolean) => void; setRestoredPresentation: SetState<RestoredPresentation | null>; setAwayFromBottom: SetState<boolean>;
};

// `savedPresentation`: the saved scroll/anchor of this session (null = none); `presentation` is it or the defaults.
export function restoreScroll({ viewportRef, listRef, hasSnapshot, sessionId, restoredSessionRef, followRef, streamId, presentationRevision, savedPresentation, scrollReady, renderedMessageCount, messageCount, restoringScrollRef, lastScrollTopRef, presentation, setFollowOutput, setRestoredPresentation, setAwayFromBottom }: RestoreScroll) {
  const viewport = viewportRef.current;
  const list = listRef.current;
  if (!viewport || !list || !hasSnapshot || scrollReady || renderedMessageCount !== messageCount) return undefined;
  restoringScrollRef.current = true;
  const sameSession = restoredSessionRef.current === sessionId;
  let frame = 0;
  const finish = () => {
    frame = requestAnimationFrame(() => {
      lastScrollTopRef.current = viewport.scrollTop;
      const away = Boolean(savedPresentation) && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
      setFollowOutput(sameSession ? followRef.current : !away);
      setAwayFromBottom(away);
      restoredSessionRef.current = sessionId;
      restoringScrollRef.current = false;
      setRestoredPresentation({ streamId, revision: presentationRevision });
    });
  };
  if (sameSession || !list.revealMessage(presentation.anchor?.key, { offset: presentation.anchor?.offset, onReveal: finish })) {
    if (sameSession ? followRef.current : !savedPresentation || !Number.isFinite(presentation.scrollTop)) list.pin();
    else if (!sameSession) list.scrollTo(presentation.scrollTop);
    finish();
  }
  return () => {
    cancelAnimationFrame(frame);
    list.cancelReveal();
    restoringScrollRef.current = false;
  };
}
