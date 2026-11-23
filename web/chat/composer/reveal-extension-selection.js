
export function revealExtensionSelection({ extensionListRef }) {
    extensionListRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }
