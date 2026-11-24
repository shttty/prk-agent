
export function anchorDisclosure({ scrollTo, disclosureRef, viewportRef, lastScrollTopRef, setAwayFromBottom }) {
    const pending = disclosureRef.current;
    const viewport = viewportRef.current;
    if (!pending || !viewport) return;
    disclosureRef.current = null;
    scrollTo(pending.scrollTop + (pending.node.getBoundingClientRect().top - pending.top));
    if (lastScrollTopRef) lastScrollTopRef.current = viewport.scrollTop;
    setAwayFromBottom?.(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80);
  }
