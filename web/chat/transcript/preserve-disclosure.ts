import type { PendingDisclosure, ScrollRef, SetState, ViewportRef } from "./scroll-types.ts";

type PreserveDisclosure = { viewportRef: ViewportRef; disclosureRef: ScrollRef<PendingDisclosure | null>; setDisclosureRevision: SetState<number>; setFollowOutput: (follow: boolean) => void };

export function preserveDisclosure({ viewportRef, disclosureRef, setDisclosureRevision, setFollowOutput }: PreserveDisclosure, node: Element | null) {
    const viewport = viewportRef.current;
    if (!viewport || !node) return;
    disclosureRef.current = { node, top: node.getBoundingClientRect().top, scrollTop: viewport.scrollTop };
    setDisclosureRevision((value) => value + 1);
    setFollowOutput(false);
  }
