import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { visiblePresentationAnchor } from "./presentation/visible-presentation-anchor.js";
import { findPresentationAnchor } from "./presentation/find-presentation-anchor.js";
export function useHistoryPagination({ actions, viewportRef, restoringScrollRef, lastScrollTopRef, setFollowing, setAwayFromBottom, scrollReady, messageCount, renderedMessageCount }) {
  const before = useWorkbench((state) => state.session.snapshot?.historyBefore);
  const page = useWorkbench((state) => state.session.historyPage);
  const revision = useWorkbench((state) => state.session.historyPageRevision);
  const streamId = useWorkbench((state) => state.session.streamId);
  const sessionId = useWorkbench((state) => state.selectedSessionId);
  const pending = useRef(null);
  const loadMore = useCallback(async () => {
    if (!scrollReady || !before || page.loading || pending.current) return;
    setFollowing(false);
    await actions.loadHistoryPage(() => {
      const viewport = viewportRef.current;
      if (viewport) pending.current = { streamId, sessionId, revision: revision + 1, anchor: visiblePresentationAnchor(viewport), scrollTop: viewport.scrollTop, height: viewport.scrollHeight };
    });
  }, [actions, before, page.loading, pending, revision, scrollReady, sessionId, streamId, setFollowing, viewportRef]);
  const restorePrepend = useEffectEvent(() => {
    const saved = pending.current;
    const viewport = viewportRef.current;
    if (!saved || !viewport) return;
    if (saved.streamId !== streamId || saved.sessionId !== sessionId) { pending.current = null; return; }
    if (saved.revision !== revision || messageCount !== renderedMessageCount) return;
    restoringScrollRef.current = true;
    const restore = () => {
      const node = findPresentationAnchor(viewport, saved.anchor);
      if (node) viewport.scrollTop += node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.anchor.offset;
      else viewport.scrollTop = saved.scrollTop + viewport.scrollHeight - saved.height;
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
    };
    restore();
    const frame = requestAnimationFrame(() => {
      restore();
      restoringScrollRef.current = false;
      pending.current = null;
      actions.noteScroll(() => viewport.isConnected ? { scrollTop: viewport.scrollTop, anchor: visiblePresentationAnchor(viewport) } : null);
    });
    return () => { cancelAnimationFrame(frame); restoringScrollRef.current = false; };
  });
  useLayoutEffect(() => restorePrepend(), [revision, messageCount, renderedMessageCount, streamId, sessionId]);
  return { before, page, revision, loadMore };
}
