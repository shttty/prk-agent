import type { ChatActions } from "../thread/chat-actions-types.ts";

export function loadReferenceCandidates({ referenceQuery, actions }: { referenceQuery: string | null; actions: ChatActions }) {
    if (referenceQuery === null) {
      actions.clearReferenceCandidates();
      return;
    }
    void actions.loadReferenceCandidates(referenceQuery);
  }
