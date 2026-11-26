import type { PendingDisclosure, ScrollRef, SetState, ViewportRef } from "./scroll-types.ts";

type FollowTranscript = {
  pin: () => void; viewportRef: ViewportRef; messagesRef: ScrollRef<HTMLElement | null>; composerOverlays: HTMLElement | null; scrollReady: boolean;
  followRef: ScrollRef<boolean>; searchOpen: boolean; disclosureRef: ScrollRef<PendingDisclosure | null>; lastScrollTopRef: ScrollRef<number>;
  setAwayFromBottom: SetState<boolean>; setNewMessages: SetState<boolean>;
};

/** Keeps the transcript pinned while following, and updates awayFromBottom across all viewport, message and composer feedback resizes. */
export function followTranscript({ pin, viewportRef, messagesRef, composerOverlays, scrollReady, followRef, searchOpen, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages }: FollowTranscript) {
  if (!scrollReady || typeof ResizeObserver !== "function") return undefined;
  const viewport = viewportRef.current;
  const messages = messagesRef.current;
  if (!viewport) return undefined;
  const sync = (entries: ResizeObserverEntry[] = []) => {
    if (!viewport.isConnected) return;
    // Update the tail before pinning to the new scroll extent, in the same observer delivery.
    if (composerOverlays && (!entries.length || entries.some(({ target }) => target === composerOverlays))) {
      // Exception to "no measured CSS variables": the overlay strip floats over the transcript (composer.css), so its
      // height is the transcript's bottom padding and has to follow it frame by frame.
      viewport.style.setProperty("--pi-composer-overlay-height", `${composerOverlays.getBoundingClientRect().height}px`);
    }
    if (disclosureRef.current) return;
    if (followRef.current && !searchOpen) {
      pin();
      lastScrollTopRef.current = viewport.scrollTop;
      setAwayFromBottom(false);
      setNewMessages(false);
      return;
    }
    const away = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop >= 80;
    setAwayFromBottom(away);
    if (!away) setNewMessages(false);
  };
  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(viewport);
  if (messages) observer.observe(messages);
  if (composerOverlays) observer.observe(composerOverlays, { box: "border-box" });
  return () => observer.disconnect();
}
