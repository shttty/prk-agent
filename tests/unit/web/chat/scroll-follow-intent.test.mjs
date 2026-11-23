import assert from "node:assert/strict";
import test from "node:test";
import { notifyTranscriptChange } from "../../../../web/chat/transcript/notify-transcript-change.js";
import { saveScroll } from "../../../../web/chat/transcript/save-scroll.js";
import { noteScrollIntent } from "../../../../web/chat/transcript/note-scroll-intent.js";

// One transcript viewport with the ChatSurface wiring: browser scroll events go through saveScroll, reader input
// through noteScrollIntent, transcript growth through notifyTranscriptChange.
function transcript({ scrollHeight = 2000, clientHeight = 600 } = {}) {
  let top = scrollHeight - clientHeight;
  // Like the browser, scrollTop stays within [0, scrollHeight - clientHeight].
  const viewport = { scrollHeight, clientHeight, clientWidth: 590, isConnected: true, contains: (node) => node === viewport.child, child: {},
    get scrollTop() { return top; }, set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); } };
  const viewportRef = { current: viewport };
  const lastScrollTopRef = { current: viewport.scrollTop };
  const followRef = { current: true };
  const intentRef = { current: { touchY: null, scrollbar: false } };
  const view = { awayFromBottom: false, newMessages: false };
  const setFollowOutput = (next) => { followRef.current = next; };
  const setAwayFromBottom = (next) => { view.awayFromBottom = next; };
  const setNewMessages = (next) => { view.newMessages = typeof next === "function" ? next(view.newMessages) : next; };
  const shared = { viewportRef, lastScrollTopRef, followRef, setAwayFromBottom, setNewMessages };
  let revision = 0;
  return {
    viewport, followRef, view,
    // The browser moved scrollTop (input or clamping) and fired a scroll event.
    scrolled(value) {
      viewport.scrollTop = value;
      saveScroll({ ...shared, scrollReady: true, restoringScrollRef: { current: false }, disclosureRef: { current: null }, intentRef, setFollowOutput, actions: { noteScroll() {} } }, { currentTarget: viewport });
    },
    // Layout changed: the browser clamps scrollTop to the new maximum and fires a scroll event when it moved.
    resized({ scrollHeight = viewport.scrollHeight, clientHeight = viewport.clientHeight }) {
      Object.assign(viewport, { scrollHeight, clientHeight });
      if (top > scrollHeight - clientHeight) this.scrolled(top);
    },
    grew(by) {
      viewport.scrollHeight += by;
      notifyTranscriptChange({ ...shared, scrollReady: true, hasSnapshot: true, searchOpen: false, transcriptRevision: ++revision });
    },
    input(event) { noteScrollIntent({ viewportRef, intentRef, setFollowOutput }, event); },
    gap: () => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
  };
}

test("passive scroll from a shrinking transcript or growing viewport keeps following", () => {
  const t = transcript();
  t.resized({ scrollHeight: 1700 }); // a tool card collapses / streamed text is replaced by a shorter final message
  t.resized({ clientHeight: 720 }); // the composer, pending queue or running strip gets shorter
  assert.equal(t.followRef.current, true);
  t.grew(400);
  assert.equal(t.gap(), 0, "growth after a clamp is still pinned to the bottom");
  assert.deepEqual(t.view, { awayFromBottom: false, newMessages: false });
});

test("wheel up stops following until the reader scrolls back to the bottom", () => {
  const t = transcript();
  t.input({ type: "wheel", deltaY: -120 });
  t.scrolled(t.viewport.scrollTop); // the scroll event of an earlier pin arrives after the wheel, before it moves
  assert.equal(t.followRef.current, false);
  t.scrolled(t.viewport.scrollTop - 400);
  assert.equal(t.followRef.current, false);
  assert.equal(t.view.awayFromBottom, true);
  t.grew(300);
  assert.equal(t.gap(), 700, "new content does not yank the reader");
  assert.equal(t.view.newMessages, true);
  t.scrolled(t.viewport.scrollHeight);
  assert.equal(t.followRef.current, true);
  t.grew(100);
  assert.equal(t.gap(), 0);
});

test("touch drag, up keys and a scrollbar drag stop following; inputs that cannot scroll up do not", () => {
  const touch = transcript();
  touch.input({ type: "touchstart", touches: [{ clientY: 100 }] });
  touch.input({ type: "touchmove", touches: [{ clientY: 160 }] });
  assert.equal(touch.followRef.current, false, "finger dragging the content down scrolls up");

  const keys = transcript();
  keys.input({ type: "keydown", key: "ArrowUp", target: {} }); // focus is elsewhere, e.g. the composer
  assert.equal(keys.followRef.current, true);
  keys.input({ type: "keydown", key: "PageUp", target: keys.viewport.child });
  assert.equal(keys.followRef.current, false);

  const bar = transcript();
  bar.input({ type: "pointerdown", target: bar.viewport, nativeEvent: { offsetX: 605 } });
  bar.scrolled(bar.viewport.scrollTop - 300);
  assert.equal(bar.followRef.current, false);
  bar.input({ type: "pointerup" });
  bar.scrolled(bar.viewport.scrollHeight);
  bar.resized({ scrollHeight: 1800 });
  assert.equal(bar.followRef.current, true, "after the scrollbar is released a clamp is passive again");

  const short = transcript({ scrollHeight: 600 });
  short.input({ type: "wheel", deltaY: -120 });
  short.input({ type: "touchstart", touches: [{ clientY: 100 }] });
  short.input({ type: "touchmove", touches: [{ clientY: 160 }] });
  assert.equal(short.followRef.current, true, "a transcript already at its top keeps following");
});
