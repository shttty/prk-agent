import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkbenchStore } from "../../../../web/workbench/store/assemble-workbench-store.js";
import { saveScroll } from "../../../../web/chat/transcript/save-scroll.js";

function scrollHarness() {
  const store = createWorkbenchStore();
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  const viewport = { scrollHeight: 20000, clientHeight: 800, scrollTop: 0, isConnected: true, getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [] };
  const noop = () => {};
  const refs = { lastScrollTopRef: { current: 0 }, followRef: { current: false }, intentRef: { current: { touchY: null, scrollbar: false } } };
  const scrollTo = (top) => {
    viewport.scrollTop = top;
    saveScroll({ scrollReady: true, restoringScrollRef: { current: false }, disclosureRef: { current: null }, ...refs, setFollowOutput: noop, setAwayFromBottom: noop, setNewMessages: noop, actions: store.actions }, { currentTarget: viewport });
  };
  return { store, viewport, scrollTo, notifications: () => notifications };
}

test("a scroll gesture notifies the store once, after scrolling stops", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { store, scrollTo, notifications } = scrollHarness();
  for (let i = 1; i <= 60; i += 1) { scrollTo(i * 100); t.mock.timers.tick(16); }
  assert.equal(notifications(), 0, "scroll events must not patch the store while the reader is still scrolling");
  t.mock.timers.tick(200);
  assert.equal(notifications(), 1);
  assert.equal(store.getSnapshot().presentation.scrollTop, 6000, "the latest position is what gets saved");
});

test("a flush after the viewport left the document saves nothing", () => {
  const { store, viewport, scrollTo, notifications } = scrollHarness();
  scrollTo(500);
  viewport.isConnected = false;
  store.actions.flushScroll();
  assert.equal(notifications(), 0);
  assert.equal(store.getSnapshot().presentation, null);
});
