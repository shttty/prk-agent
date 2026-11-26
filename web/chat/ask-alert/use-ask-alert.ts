import { useRef } from "react";
import { useEffectEvent } from "react";
import { useEffect } from "react";
import { TITLE_MARK } from "./ask-alert-constants.ts";
import { askNotifyEnabled } from "./ask-notify-enabled.ts";
import { away } from "./away.ts";
/** `waiting`: `askingSessions(...)`; `onOpen(sessionId)` selects the session whose notification was clicked. */
export function useAskAlert(waiting: { sessionId: string; label: string }[], onOpen: (sessionId: string) => void) {
  const notes = useRef(new Map<string, Notification>());
  const open = useEffectEvent(onOpen);
  const latest = useEffectEvent(() => waiting);
  const key = waiting.map((item) => item.sessionId).join("\n");
  useEffect(() => {
    const items = latest();
    const title = document.title;
    const current = notes.current;
    const sync = () => {
      const background = away();
      document.title = background && items.length ? `${TITLE_MARK}${title}` : title;
      for (const [sessionId, note] of current) {
        if (background && items.some((item) => item.sessionId === sessionId)) continue;
        note.close();
        current.delete(sessionId);
      }
      if (!background || !askNotifyEnabled()) return;
      for (const { sessionId, label } of items) {
        if (current.has(sessionId)) continue;
        try {
          const note = new window.Notification(label, { body: "有问题等待回答", tag: `prk-ask:${sessionId}` });
          note.onclick = () => { window.focus(); note.close(); open(sessionId); };
          current.set(sessionId, note);
        } catch { /* the browser refused this one; the title mark still tells */ }
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.title = title;
    };
  }, [key]);
}
