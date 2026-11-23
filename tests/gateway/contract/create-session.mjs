import { randomUUID } from "node:crypto";

/** One redacted SessionHost behind a routing identity, with its own sequence. */
export function createSession(sessionId, target, cwd, onCall, waitForSubmission) {
  let streamId = `stream-${sessionId}`;
  const listeners = new Set();
  let sequence = 0;
  let messages = [];
  const snapshot = () => ({ streamId, sessionId, sequence, state: "idle", messages, recentOperations: [], cwd });
  const deliver = (type, extra = {}) => {
    const event = { streamId, sessionId, sequence: ++sequence, timestamp: new Date().toISOString(), type, ...extra };
    for (const listener of [...listeners]) listener(event);
    return event;
  };
  return {
    sessionId, target, cwd, listeners, deliver,
    setMessages: (value) => { messages = value; },
    replaceStream() {
      streamId = randomUUID(); sequence = 0;
      const next = snapshot();
      for (const listener of [...listeners]) listener({ streamId, sessionId, sequence, timestamp: new Date().toISOString(), type: "snapshot", details: { snapshot: next } });
      return next;
    },
    host: {
      sessionId,
      getSnapshot: snapshot,
      subscribe(listener) {
        listeners.add(listener);
        const initial = snapshot();
        // Reentrant transition after snapshot capture, before subscribe returns.
        listener({ streamId, sessionId, sequence: ++sequence, timestamp: new Date().toISOString(), type: "state_changed" });
        return { snapshot: initial, unsubscribe: () => listeners.delete(listener) };
      },
      submit: async () => { onCall(); await waitForSubmission(); return { accepted: false, requestId: "held", error: "controlled" }; },
      cancel: async () => { onCall(); return { operationId: "none", status: "not_found", droppedRequestIds: [], unknownRequestIds: [] }; },
      reload: async () => { onCall(); },
      close: async () => { onCall(); },
    },
  };
}
