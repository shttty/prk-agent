/** Keeps the transcript pinned while following, and updates awayFromBottom across all viewport, message and composer feedback resizes. */
export function followTranscript({ viewportRef, messagesRef, composerOverlays, scrollReady, followRef, searchOpen, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages }) {
  if (!scrollReady || typeof ResizeObserver !== "function") return undefined;
  const viewport = viewportRef.current;
  const messages = messagesRef.current;
  if (!viewport) return undefined;
  const sync = (entries = []) => {
    if (!viewport.isConnected) return;
    // Update the tail before pinning to the new scroll extent, in the same observer delivery.
    if (composerOverlays && (!entries.length || entries.some(({ target }) => target === composerOverlays))) {
      viewport.style.setProperty("--pi-composer-overlay-height", `${composerOverlays.getBoundingClientRect().height}px`);
    }
    if (disclosureRef.current) return;
    if (followRef.current && !searchOpen) {
      viewport.scrollTop = viewport.scrollHeight;
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom?.(false);
      setNewMessages?.(false);
      return;
    }
    const away = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
    setAwayFromBottom?.(away);
    if (!away) setNewMessages?.(false);
  };
  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(viewport);
  if (messages) observer.observe(messages);
  if (composerOverlays) observer.observe(composerOverlays, { box: "border-box" });
  return () => observer.disconnect();
}
