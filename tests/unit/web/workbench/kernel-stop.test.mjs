import assert from "node:assert/strict";
import test from "node:test";
import { cancelOperation } from "../../../../web/workbench/store/messages/cancel-operation.js";

const cell = { kernelId: "kernel-1", cellId: "cell-1" };
const seen = { sessionId: "selected", streamId: "stream-1", cell };

function selection() {
  return { apiRoot: "/api", listeners: new Set(), selectionToken: 1, draftRevision: 0, storage: { persistSession() {} }, state: {
    selectedSessionId: "selected", draft: "unfinished draft",
    session: { streamId: "stream-1", connection: "connected", snapshot: { kernel: { activeCells: [cell] } }, operations: new Map(), pending: new Set(), activities: [], localMessages: new Map() },
  } };
}

test("a stop with no model operation targets the visible cell once and returns queued input to the draft", async (t) => {
  const ctx = selection();
  const response = Promise.withResolvers();
  const fetch = t.mock.method(globalThis, "fetch", () => response.promise);
  assert.equal(await cancelOperation(ctx, { ...seen, streamId: "retired" }), false);
  assert.equal(await cancelOperation(ctx, seen, "retired-ask"), false);
  assert.equal(fetch.mock.callCount(), 0);

  const requested = cancelOperation(ctx, seen);
  assert.equal(await cancelOperation(ctx, seen), false);
  assert.equal(fetch.mock.callCount(), 1);
  const [path, init] = fetch.mock.calls[0].arguments;
  assert.equal(path, "/api/sessions/selected/kernel/interrupt");
  assert.deepEqual(JSON.parse(init.body), cell);
  response.resolve(Response.json({ status: "requested", returnedMessages: ["queued input"] }));
  assert.equal(await requested, true);
  assert.equal(ctx.state.draft, "unfinished draft\n\nqueued input");
  assert.equal(ctx.state.session.pending.has("stopping"), false);
});

test("a stop during a model operation sends both of the observed identities", async (t) => {
  const ctx = selection();
  ctx.state.session.snapshot.operation = { operationId: "operation-1" };
  const fetch = t.mock.method(globalThis, "fetch", () => Response.json({ status: "already_complete", returnedMessages: [] }));
  await cancelOperation(ctx, { ...seen, operationId: "operation-1" });
  const [path, init] = fetch.mock.calls[0].arguments;
  assert.equal(path, "/api/sessions/selected/cancel");
  assert.deepEqual(JSON.parse(init.body), { operationId: "operation-1", cell });
});

test("several live cells are never picked for an unselected stop, and a directed stop blocks only its own row", async (t) => {
  const ctx = selection();
  const peer = { kernelId: "kernel-1", cellId: "cell-2" };
  ctx.state.session.snapshot.kernel.activeCells = [cell, peer];
  const response = Promise.withResolvers();
  const fetch = t.mock.method(globalThis, "fetch", () => response.promise.then(() => Response.json({ status: "requested", returnedMessages: [] })));
  assert.equal(await cancelOperation(ctx), false, "no operation and no selection: nothing to stop");
  assert.equal(fetch.mock.callCount(), 0);
  const directed = (target) => cancelOperation(ctx, { sessionId: "selected", streamId: "stream-1", cellOnly: true, cell: target });
  const first = directed(cell);
  assert.equal(await directed(cell), false, "the same row is not stopped twice while pending");
  const second = directed(peer);
  assert.equal(fetch.mock.callCount(), 2, "a pending row does not block its peer");
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [, init] }) => JSON.parse(init.body)), [{ ...cell, cellOnly: true }, { ...peer, cellOnly: true }]);
  response.resolve();
  assert.deepEqual([await first, await second], [true, true]);
  assert.equal(ctx.state.session.pending.size, 0);
});
