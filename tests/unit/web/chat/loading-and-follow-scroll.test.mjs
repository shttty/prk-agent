import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchStore } from "../../../../web/workbench/store/assemble-workbench-store.js";
import { sessionHistoryLoading } from "../../../../web/chat/thread/session-history-loading.js";
import { notifyTranscriptChange } from "../../../../web/chat/transcript/notify-transcript-change.js";
import { followTranscript } from "../../../../web/chat/transcript/follow-transcript.js";
import { saveScroll } from "../../../../web/chat/transcript/save-scroll.js";
import { anchorDisclosure } from "../../../../web/chat/transcript/anchor-disclosure.js";
import { restoreScroll } from "../../../../web/chat/transcript/restore-scroll.js";
import { noteScrollIntent } from "../../../../web/chat/transcript/note-scroll-intent.js";

test("switching sessions keeps history loading true across EventSource open until base snapshot arrives", async () => {
  const sources = [];
  const previousEventSource = globalThis.EventSource;
  const previousFetch = globalThis.fetch;
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 1;
      sources.push(this);
      if (url.endsWith("/sessions/events")) {
        queueMicrotask(() => {
          this.dispatchEvent(new Event("open"));
          this.emit("snapshot", {
            targets: [{ id: "local", label: "Local", local: true, cwd: "/tmp" }],
            sessions: [
              { sessionId: "s1", target: "local", label: "one", state: "idle", cwd: "/tmp" },
              { sessionId: "s2", target: "local", label: "two", state: "idle", cwd: "/tmp" },
            ],
          });
        });
      }
    }
    close() { this.readyState = 2; }
    emit(type, payload) {
      this.dispatchEvent(new MessageEvent(type, payload === undefined ? {} : { data: JSON.stringify(payload) }));
    }
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ commands: [] }) });
  try {
    const store = createWorkbenchStore();
    store.start();
    await new Promise((done) => setTimeout(done, 0));
    const seedSnapshot = {
      streamId: "stream-1",
      sessionId: "s1",
      sequence: 1,
      state: "idle",
      messages: [{ role: "user", content: "hello", timestamp: 1 }],
      messageEntryIds: ["e1"],
      recentOperations: [],
    };
    await store.actions.selectSession("s1", { snapshot: seedSnapshot });
    assert.equal(sessionHistoryLoading(store.getSnapshot()), false);

    const seenTransitions = [];
    const unsubscribe = store.subscribe(() => {
      const state = store.getSnapshot();
      seenTransitions.push({
        selectedSessionId: state.selectedSessionId,
        hasSnapshot: Boolean(state.session.snapshot),
        loading: sessionHistoryLoading(state),
      });
    });

    await store.actions.selectSession("s2");
    assert.equal(
      seenTransitions.some((step) => step.selectedSessionId === "s1" && !step.hasSnapshot),
      false,
      "switching must not wipe s1 snapshot before selectedSessionId changes to s2",
    );
    assert.equal(sessionHistoryLoading(store.getSnapshot()), true);

    const s2Source = sources.at(-1);
    s2Source.readyState = 1;
    s2Source.dispatchEvent(new Event("open"));
    assert.equal(
      sessionHistoryLoading(store.getSnapshot()),
      true,
      "EventSource open before first snapshot must keep historyLoading true",
    );

    s2Source.emit("snapshot", {
      snapshot: { streamId: "stream-2", sessionId: "s2", sequence: 1, state: "idle", messages: [], messageEntryIds: [], recentOperations: [] },
    });
    assert.equal(sessionHistoryLoading(store.getSnapshot()), false);
    unsubscribe();
    store.dispose();
  } finally {
    globalThis.EventSource = previousEventSource;
    globalThis.fetch = previousFetch;
  }
});

test("following transcript stays pinned across viewport shrink and incoming messages, yields on upward scroll, and resumes on send", () => {
  const observers = [];
  const previousResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
  };
  try {
    const viewport = { scrollHeight: 1600, clientHeight: 600, scrollTop: 1000, isConnected: true, getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [] };
    const messages = {};
    const viewportRef = { current: viewport };
    const messagesRef = { current: messages };
    const restoringScrollRef = { current: false };
    const disclosureRef = { current: null };
    const lastScrollTopRef = { current: 1000 };
    const intentRef = { current: { touchY: null, scrollbar: false } };
    const followRef = { current: true };
    let followOutput = true;
    let awayFromBottom = false;
    let newMessages = false;
    const setFollowing = (next) => { followRef.current = next; followOutput = next; };
    const setAwayFromBottom = (next) => { awayFromBottom = next; };
    const setNewMessages = (next) => { newMessages = typeof next === "function" ? next(newMessages) : next; };
    const actions = { noteScroll: () => {} };

    const cleanup = followTranscript({
      viewportRef, messagesRef, scrollReady: true, followOutput, followRef, searchOpen: false, disclosureRef, lastScrollTopRef,
    });

    // SendStatus mounts under composer, shrinking viewport height before user bubble arrives:
    viewport.clientHeight = 560;
    saveScroll({ scrollReady: true, restoringScrollRef, disclosureRef, lastScrollTopRef, followRef, setFollowOutput: setFollowing, setAwayFromBottom, setNewMessages, actions }, { currentTarget: viewport });
    assert.equal(followOutput, true, "viewport shrink without upward scroll must not cancel followOutput");
    observers.at(-1).cb();
    assert.equal(viewport.scrollTop, 1600);

    // SDK user bubble and streaming reply grow scrollHeight:
    viewport.scrollHeight = 2100;
    notifyTranscriptChange({ scrollReady: true, followRef, searchOpen: false, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision: 2 });
    assert.equal(viewport.scrollTop, 2100);
    assert.equal(awayFromBottom, false);
    assert.equal(newMessages, false);

    // Reader wheels up to inspect history:
    noteScrollIntent({ viewportRef, intentRef, setFollowOutput: setFollowing }, { type: "wheel", deltaY: -120 });
    viewport.scrollTop = 400;
    saveScroll({ scrollReady: true, restoringScrollRef, disclosureRef, lastScrollTopRef, followRef, intentRef, setFollowOutput: setFollowing, setAwayFromBottom, setNewMessages, actions }, { currentTarget: viewport });
    assert.equal(followOutput, false);
    assert.equal(awayFromBottom, true);

    // Incoming message while scrolled up does NOT yank reader:
    viewport.scrollHeight = 2400;
    notifyTranscriptChange({ scrollReady: true, followRef, searchOpen: false, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision: 3 });
    assert.equal(viewport.scrollTop, 400);
    assert.equal(newMessages, true);

    // Reader sends a new message (followLatest) -> SDK user bubble arrives asynchronously:
    setFollowing(true);
    setNewMessages(false);
    setAwayFromBottom(false);
    viewport.scrollTop = viewport.scrollHeight;
    lastScrollTopRef.current = viewport.scrollTop;

    viewport.scrollHeight = 2650;
    notifyTranscriptChange({ scrollReady: true, followRef, searchOpen: false, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision: 4 });
    assert.equal(viewport.scrollTop, 2650, "new message after send scrolls to bottom synchronously");
    assert.equal(awayFromBottom, false);
    assert.equal(newMessages, false);

    cleanup?.();
  } finally {
    globalThis.ResizeObserver = previousResizeObserver;
  }
});

test("awayFromBottom updates on disclosure/resize without scroll events and survives cancelled restore RAF or stream swap", () => {
  const observers = [];
  const previousResizeObserver = globalThis.ResizeObserver;
  const previousWindow = globalThis.window;
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() {}
  };
  globalThis.window = { requestAnimationFrame: () => 42, cancelAnimationFrame: () => {} };
  try {
    const viewport = { scrollHeight: 1600, clientHeight: 600, scrollTop: 1000, isConnected: true, getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [] };
    const viewportRef = { current: viewport };
    const messagesRef = { current: {} };
    const lastScrollTopRef = { current: 1000 };
    const followRef = { current: false };
    const disclosureRef = { current: { node: { getBoundingClientRect: () => ({ top: 100 }) }, top: 100, scrollTop: 1000 } };
    let away = false;
    let newMessages = true;
    const setAwayFromBottom = (next) => { away = next; };
    const setNewMessages = (next) => { newMessages = next; };

    // Expanding a <details> block below the header adds 500px height without moving scrollTop:
    viewport.scrollHeight = 2100;
    anchorDisclosure({ disclosureRef, viewportRef, lastScrollTopRef, setAwayFromBottom });
    assert.equal(away, true, "expanding disclosure reveals jump button without requiring onScroll");

    // Collapsing it back via ResizeObserver hides jump button and clears newMessages:
    const cleanup = followTranscript({ viewportRef, messagesRef, scrollReady: true, followRef, searchOpen: false, disclosureRef, lastScrollTopRef, setAwayFromBottom, setNewMessages });
    viewport.scrollHeight = 1600;
    observers.at(-1).cb();
    assert.equal(away, false);
    assert.equal(newMessages, false);
    cleanup?.();

    // Synchronous restore sets awayFromBottom before RAF runs, and stream swap (!scrollReady && hasSnapshot) preserves it:
    away = false;
    let follow = true;
    const cancel = restoreScroll({
      viewportRef, hasSnapshot: true, streamId: "live-2", presentationRevision: 1, sessionId: "session-a", restoredSessionRef: { current: null }, followRef: { current: true },
      savedPresentation: { scrollTop: 300, anchor: null }, scrollReady: false,
      renderedMessageCount: 5, messageCount: 5, restoringScrollRef: { current: false }, lastScrollTopRef,
      presentation: { scrollTop: 300, anchor: null },
      setFollowOutput: (next) => { follow = next; }, setRestoredPresentation: () => {}, setAwayFromBottom,
    });
    cancel?.();
    assert.equal(follow, false);
    assert.equal(away, true, "synchronous restore keeps jump button visible even when RAF is cancelled");

    notifyTranscriptChange({ scrollReady: false, hasSnapshot: true, followRef, searchOpen: false, lastScrollTopRef, setNewMessages, setAwayFromBottom, viewportRef, transcriptRevision: 1 });
    assert.equal(away, true, "same-session stream swap does not blank awayFromBottom while snapshot exists");
  } finally {
    globalThis.ResizeObserver = previousResizeObserver;
    globalThis.window = previousWindow;
  }
});
