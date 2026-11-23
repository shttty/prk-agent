/** Keeps the transcript pinned while following, and updates awayFromBottom across all viewport/message resizes. */
export function followTranscript({ viewportRef, messagesRef, scrollReady, followRef, searchOpen, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages }) {
  if (!scrollReady || typeof ResizeObserver !== "function") return undefined;
  const viewport = viewportRef.current;
  const messages = messagesRef.current;
  if (!viewport) return undefined;
  const sync = () => {
    if (!viewport.isConnected || disclosureRef.current) return;
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
  return () => observer.disconnect();
}
