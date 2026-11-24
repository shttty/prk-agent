
export function notifyTranscriptChange({ pin, scrollReady, hasSnapshot, followRef, searchOpen, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision }) {
    if (!scrollReady) {
      if (!hasSnapshot) { setNewMessages(false); setAwayFromBottom(false); }
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (followRef?.current && !searchOpen) {
      pin();
      if (lastScrollTopRef) lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(false);
      setNewMessages(false);
      return;
    }
    if (transcriptRevision === undefined) return;
    const away = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
    setAwayFromBottom(away);
    if (away) setNewMessages(true);
  }
