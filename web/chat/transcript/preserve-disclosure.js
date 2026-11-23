
export function preserveDisclosure({ viewportRef, disclosureRef, setDisclosureRevision, setFollowOutput }, node) {
    const viewport = viewportRef.current;
    if (!viewport || !node) return;
    disclosureRef.current = { node, top: node.getBoundingClientRect().top, scrollTop: viewport.scrollTop };
    setDisclosureRevision((value) => value + 1);
    setFollowOutput(false);
  }
