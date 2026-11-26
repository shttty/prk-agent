import type { RefObject } from "react";

export function revealReferenceSelection({ referenceListRef }: { referenceListRef: RefObject<HTMLElement | null> }) {
    referenceListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
