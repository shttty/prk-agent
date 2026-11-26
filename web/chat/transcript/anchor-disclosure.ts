import type { PendingDisclosure, ScrollRef, SetState, ViewportRef } from "./scroll-types.ts";

type AnchorDisclosure = { scrollTo: (offset: number) => void; disclosureRef: ScrollRef<PendingDisclosure | null>; viewportRef: ViewportRef; lastScrollTopRef: ScrollRef<number>; setAwayFromBottom: SetState<boolean> };

export function anchorDisclosure({ scrollTo, disclosureRef, viewportRef, lastScrollTopRef, setAwayFromBottom }: AnchorDisclosure) {
    const pending = disclosureRef.current;
    const viewport = viewportRef.current;
    if (!pending || !viewport) return;
    disclosureRef.current = null;
    scrollTo(pending.scrollTop + (pending.node.getBoundingClientRect().top - pending.top));
    lastScrollTopRef.current = viewport.scrollTop;
    setAwayFromBottom(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
  }
