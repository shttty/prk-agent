import assert from "node:assert/strict";
import test from "node:test";
import { restoreScroll } from "../../../../web/chat/transcript/restore-scroll.js";

test("same-session stream replacement preserves following; another session restores its reading position", () => {
  const previousWindow = globalThis.window;
  const frames = [];
  globalThis.window = { requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; } };
  try {
    let top = 0;
    const viewport = {
      scrollHeight: 2000, clientHeight: 600, isConnected: true,
      get scrollTop() { return top; },
      set scrollTop(value) { top = Math.min(value, this.scrollHeight - this.clientHeight); },
      querySelector: () => ({ getBoundingClientRect: () => ({ top: 100 }) }),
      getBoundingClientRect: () => ({ top: 0 }),
    };
    const followRef = { current: false };
    const restoredSessionRef = { current: null };
    let away;
    const restore = (sessionId, streamId) => {
      restoreScroll({
        viewportRef: { current: viewport }, hasSnapshot: true, sessionId, streamId,
        restoredSessionRef, followRef, presentationRevision: 1, scrollReady: false,
        savedPresentation: { scrollTop: 200 }, presentation: { scrollTop: 200, anchor: null },
        renderedMessageCount: 5, messageCount: 5, restoringScrollRef: { current: false },
        lastScrollTopRef: { current: top }, setFollowOutput: (value) => { followRef.current = value; },
        setRestoredPresentation: () => {}, setAwayFromBottom: (value) => { away = value; },
      });
      frames.shift()();
    };
    restore("session-a", "sleeping");
    followRef.current = true; // Sending explicitly follows latest before the wake snapshot arrives.
    viewport.scrollTop = viewport.scrollHeight;
    viewport.scrollHeight += 1000;
    restore("session-a", "awake");
    assert.equal(followRef.current, true);
    assert.equal(away, false);
    assert.equal(top, viewport.scrollHeight - viewport.clientHeight);
    restore("session-b", "other");
    assert.equal(top, 200);
    assert.equal(followRef.current, false);
    assert.equal(away, true);
    viewport.scrollTop = 500;
    restore("session-b", "reconnected");
    assert.equal(top, 500, "Same-session reconnect does not apply an old saved position");
    assert.equal(followRef.current, false);
  } finally {
    globalThis.window = previousWindow;
  }
});
