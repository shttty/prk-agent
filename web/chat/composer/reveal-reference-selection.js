
export function revealReferenceSelection({ referenceListRef }) {
    referenceListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
