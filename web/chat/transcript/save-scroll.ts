import type { UIEvent } from "react";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { PendingDisclosure, ScrollIntent, ScrollRef, SetState } from "./scroll-types.ts";
import { visiblePresentationAnchor } from "./presentation/visible-presentation-anchor.ts";

type SaveScroll = {
  scrollReady: boolean; restoringScrollRef: ScrollRef<boolean>; disclosureRef: ScrollRef<PendingDisclosure | null>; lastScrollTopRef: ScrollRef<number>;
  followRef: ScrollRef<boolean>; intentRef: ScrollRef<ScrollIntent>; setFollowOutput: (follow: boolean) => void; setAwayFromBottom: SetState<boolean>;
  setNewMessages: SetState<boolean>; actions: ChatActions;
};

// A scroll event alone never stops following: content or viewport shrinking clamps scrollTop and fires the same event.
// Reader input stops it in noteScrollIntent; here only an armed scrollbar drag that moves up does. Moving down into
// the bottom zone resumes following; a late event from our own pin (no movement) must not undo a wheel just noted.
export function saveScroll({ scrollReady, restoringScrollRef, disclosureRef, lastScrollTopRef, followRef, intentRef, setFollowOutput, setAwayFromBottom, setNewMessages, actions }: SaveScroll, event: UIEvent<HTMLElement>) {
    if (!scrollReady || restoringScrollRef.current) return;
    const viewport = event.currentTarget;
    const previousTop = lastScrollTopRef.current;
    lastScrollTopRef.current = viewport.scrollTop;
    const nearBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 80;
    const scrolledUp = viewport.scrollTop < previousTop - 1;
    if (!disclosureRef.current) {
      if (scrolledUp && intentRef.current.scrollbar) setFollowOutput(false);
      else if (nearBottom && viewport.scrollTop > previousTop) setFollowOutput(true);
    }
    const following = followRef.current;
    setAwayFromBottom(!nearBottom && !following);
    setNewMessages((current) => (nearBottom || following ? false : current));
    actions.noteScroll(() => (viewport.isConnected ? { scrollTop: viewport.scrollTop, anchor: visiblePresentationAnchor(viewport) } : null));
  }
