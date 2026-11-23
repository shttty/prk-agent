import assert from "node:assert/strict";
import test from "node:test";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";

test("session snapshots and ordered state events publish command state without SDK aborts", async () => {
  let current = [{ name: "build", owner: "model", generation: "generation-a", connectionStatus: "connected",
    runningCommand: { id: "command-a", text: "sleep 30", startedAt: 100 } }];
  const listeners = new Set();
  const calls = [];
  const host = createSessionHost({
    session: { sessionId: "session-a", messages: [], subscribe: () => () => {},
      getSteeringMessages: () => [], getFollowUpMessages: () => [],
      abort: async () => { calls.push("abort"); }, clearQueue: () => ({ steering: [], followUp: [] }), dispose: () => {} },
    terminals: { getSnapshot: () => current, subscribeState: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } },
  });
  const events = [];
  const subscription = host.subscribe((event) => events.push(event));
  assert.deepEqual(subscription.snapshot.terminals, current);
  current = current.map(({ runningCommand, ...terminal }) => terminal);
  for (const listener of listeners) listener(current);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "state_changed");
  assert.equal(events[0].sessionId, "session-a");
  assert.equal(events[0].streamId, subscription.snapshot.streamId);
  assert.equal(events[0].sequence, subscription.snapshot.sequence + 1);
  assert.deepEqual(events[0].details, { terminals: current });
  assert.equal(subscription.snapshot.terminals[0].runningCommand.id, "command-a");
  assert.equal(Object.hasOwn(host.getSnapshot().terminals[0], "runningCommand"), false);
  assert.deepEqual(calls, []);
  subscription.unsubscribe();
  await host.close();
  assert.equal(listeners.size, 0, "closing the SDK host releases its terminal observation without owning the PTYs");
});
