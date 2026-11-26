import { useCallback } from "react";
import { useChatState } from "../thread/use-chat-state.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";

type HistoryPagination = { actions: ChatActions; beforePrepend: () => void; setFollowing: (follow: boolean) => void; scrollReady: boolean };

export function useHistoryPagination({ actions, beforePrepend, setFollowing, scrollReady }: HistoryPagination) {
  const before = useChatState((state) => state.session.snapshot?.historyBefore);
  const page = useChatState((state) => state.session.historyPage);
  const revision = useChatState((state) => state.session.historyPageRevision);
  const loadMore = useCallback(async () => {
    if (!scrollReady || !before || page.loading) return;
    setFollowing(false);
    await actions.loadHistoryPage(beforePrepend);
  }, [actions, before, beforePrepend, page.loading, scrollReady, setFollowing]);
  return { before, page, revision, loadMore };
}
