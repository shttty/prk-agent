import { useCallback } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";

type HistoryPagination = { actions: ChatActions; beforePrepend: () => void; setFollowing: (follow: boolean) => void; scrollReady: boolean };

export function useHistoryPagination({ actions, beforePrepend, setFollowing, scrollReady }: HistoryPagination) {
  const before = useWorkbench((state) => state.session.snapshot?.historyBefore);
  const page = useWorkbench((state) => state.session.historyPage);
  const revision = useWorkbench((state) => state.session.historyPageRevision);
  const loadMore = useCallback(async () => {
    if (!scrollReady || !before || page.loading) return;
    setFollowing(false);
    await actions.loadHistoryPage(beforePrepend);
  }, [actions, before, beforePrepend, page.loading, scrollReady, setFollowing]);
  return { before, page, revision, loadMore };
}
