import type { ScrollRef, SetState, ViewportRef } from "./scroll-types.ts";

type NotifyChange = {
  pin: () => void; scrollReady: boolean; hasSnapshot: boolean; followRef: ScrollRef<boolean>; searchOpen: boolean; lastScrollTopRef: ScrollRef<number>;
  setNewMessages: SetState<boolean>; setAwayFromBottom: SetState<boolean>; viewportRef: ViewportRef; transcriptRevision: number | undefined;
};

export function notifyTranscriptChange({ pin, scrollReady, hasSnapshot, followRef, searchOpen, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision }: NotifyChange) {
    if (!scrollReady) {
      if (!hasSnapshot) { setNewMessages(false); setAwayFromBottom(false); }
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (followRef.current && !searchOpen) {
      pin();
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(false);
      setNewMessages(false);
      return;
    }
    if (transcriptRevision === undefined) return;
    const away = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
    setAwayFromBottom(away);
    if (away) setNewMessages(true);
  }
