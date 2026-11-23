import { findPresentationAnchor } from "./presentation/find-presentation-anchor.js";
// `savedPresentation`: the saved scroll/anchor of this session (null = none); `presentation` is it or the defaults.
export function restoreScroll({ viewportRef, hasSnapshot, sessionId, restoredSessionRef, followRef, streamId, presentationRevision, savedPresentation, scrollReady, renderedMessageCount, messageCount, restoringScrollRef, lastScrollTopRef, presentation, setFollowOutput, setRestoredPresentation, setAwayFromBottom }) {
    const viewport = viewportRef.current;
    if (!viewport || !hasSnapshot || scrollReady || renderedMessageCount !== messageCount) return undefined;
    restoringScrollRef.current = true;
    const sameSession = restoredSessionRef.current === sessionId;
    const following = sameSession && followRef.current;
    restoredSessionRef.current = sessionId;
    const restored = { streamId, revision: presentationRevision };
    const desiredTop = sameSession ? (following ? viewport.scrollHeight : viewport.scrollTop)
      : savedPresentation && Number.isFinite(presentation.scrollTop) ? presentation.scrollTop : viewport.scrollHeight;
    const restore = () => {
      if (!viewport.isConnected) return;
      const anchor = !sameSession && findPresentationAnchor(viewport, presentation.anchor);
      if (anchor) {
        const delta = anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - Number(presentation.anchor.offset || 0);
        viewport.scrollTop += delta;
      } else {
        viewport.scrollTop = desiredTop;
      }
      if (lastScrollTopRef) lastScrollTopRef.current = viewport.scrollTop;
      const away = Boolean(savedPresentation) && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
      setFollowOutput(sameSession ? followRef.current : !away);
      setAwayFromBottom(away);
    };
    restore();
    if (typeof window.requestAnimationFrame !== "function") {
      restoringScrollRef.current = false;
      setRestoredPresentation(restored);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      restore();
      restoringScrollRef.current = false;
      setRestoredPresentation(restored);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      restoringScrollRef.current = false;
    };
  }
