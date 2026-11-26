import type { RefObject } from "react";

export function revealExtensionSelection({ extensionListRef }: { extensionListRef: RefObject<HTMLElement | null> }) {
    extensionListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
