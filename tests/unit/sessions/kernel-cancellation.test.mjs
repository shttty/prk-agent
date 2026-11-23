import assert from "node:assert/strict";
import test from "node:test";
import { cancel } from "../../../src/sessions/host/operations/cancel.ts";
import { interruptCell } from "../../../src/sessions/host/operations/interrupt-cell.ts";

const identity = { kernelId: "kernel-a", cellId: "cell-a" };
function fixture() {
  const calls = [];
  const ctx = {
    sessionId: "session-a", streamId: "stream-a", state: "idle", sequence: 0,
    active: undefined, recent: [], closing: false, closed: false,
    listeners: new Set(), deliveries: [], lifecycleTasks: new Set(),
    inbox: [], inboxChars: 0, discarded: new Map(), sessionOptions: {},
    options: {
      extensionUi: { cancel: () => calls.push("ui") },
      extensionHandlers: { cancel: () => calls.push("handlers") },
    },
    session: {
      clearQueue: () => { calls.push("queue"); return { steering: ["queued steer"], followUp: ["queued follow-up"] }; },
      abort: async () => { calls.push("abort"); },
    },
    kernel: {
      getSnapshot: () => ({ state: "busy", kernelId: "kernel-a", activeCells: [identity] }),
      interruptCell: (kernelId, cellId, reason) => {
        calls.push([kernelId, cellId, reason]);
        return kernelId === identity.kernelId && cellId === identity.cellId;
      },
    },
  };
  return { ctx, calls };
}
function operation(id = "operation-a") {
  return {
    id, startedAt: 1, requestIds: new Set(["request-a"]), completion: Promise.withResolvers(),
    pending: 1, cancelled: false, pythonStarted: false, returnedMessages: [],
  };
}

test("operation cancellation validates its operation before touching an observed cell", async () => {
  const { ctx, calls } = fixture();
  ctx.active = operation();
  ctx.recent = [{ operationId: "operation-old", status: "completed" }];
  assert.equal((await cancel(ctx, { operationId: "operation-old", cell: identity })).status, "already_complete");
  assert.equal((await cancel(ctx, { operationId: "missing", cell: identity })).status, "not_found");
  assert.deepEqual(calls, []);
  assert.equal(ctx.active.userCancelled, undefined);
});

test("operation cancellation never guesses a cell for an older client", async () => {
  const { ctx, calls } = fixture();
  ctx.active = operation();
  const result = await cancel(ctx, { operationId: ctx.active.id });
  assert.equal(result.status, "requested");
  assert.equal(ctx.active.userCancelled, true);
  assert.deepEqual(calls, ["ui", "queue", "handlers", "abort"]);
});

test("operation cancellation marks its observed cell before starting SDK abort", async () => {
  const { ctx, calls } = fixture();
  ctx.active = operation();
  const result = await cancel(ctx, { operationId: ctx.active.id, cell: identity });
  assert.equal(result.status, "requested");
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"], "ui", "queue", "handlers", "abort"]);
  assert.deepEqual(result.returnedMessages, ["queued steer", "queued follow-up"]);
});

test("an operation replaced while its observed cell is marked does not inherit the old stop", async () => {
  const { ctx, calls } = fixture();
  const original = ctx.active = operation();
  const replacement = operation("operation-new");
  ctx.kernel.interruptCell = () => { ctx.active = replacement; calls.push("interrupt"); return true; };
  assert.equal((await cancel(ctx, { operationId: original.id, cell: identity })).status, "requested");
  assert.equal(original.userCancelled, true);
  assert.equal(replacement.cancelled, false);
  assert.deepEqual(calls, ["interrupt"]);
});

test("targeted cancellation aborts a native SDK run without inventing a host operation", async () => {
  const { ctx, calls } = fixture();
  ctx.inbox.push({ message: { sender: "peer", messageId: "message-a" } });
  const result = await interruptCell(ctx, identity);
  assert.deepEqual(result, { ...identity, status: "requested", returnedMessages: ["queued steer", "queued follow-up"] });
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"], "ui", "queue", "handlers", "abort"]);
  assert.equal(ctx.active, undefined);
  assert.equal(ctx.state, "idle");
  assert.equal(ctx.inbox.length, 0);
  assert.equal(ctx.discarded.get("message-a").disposition, "never-delivered");
  assert.equal(ctx.sequence, 0, "no fake operation events");
});

test("accepted targeted cancellation settles an existing host operation as a user stop", async () => {
  const { ctx, calls } = fixture();
  ctx.active = operation();
  assert.equal((await interruptCell(ctx, identity)).status, "requested");
  assert.equal(ctx.active.userCancelled, true);
  assert.equal(ctx.active.cancelled, true);
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"], "ui", "queue", "handlers", "abort"]);
});

test("cell-only cancellation preserves the active turn, ask UI, and queues", async () => {
  const { ctx, calls } = fixture();
  ctx.active = operation();
  ctx.inbox.push({ message: { sender: "peer", messageId: "message-a" } });
  const result = await interruptCell(ctx, { ...identity, cellOnly: true });
  assert.deepEqual(result, { ...identity, status: "requested", returnedMessages: [] });
  assert.equal(ctx.active.userCancelled, undefined);
  assert.equal(ctx.inbox.length, 1);
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"]]);
});

test("unknown generation or cell does not clear queues or cancel other scopes", async () => {
  for (const request of [{ ...identity, kernelId: "kernel-old" }, { ...identity, cellId: "cell-old" }]) {
    const { ctx, calls } = fixture();
    assert.equal((await interruptCell(ctx, request)).status, "not_found");
    assert.deepEqual(calls, [[request.kernelId, request.cellId, "user"]]);
  }
  const { ctx, calls } = fixture();
  delete ctx.kernel.interruptCell;
  assert.equal((await interruptCell(ctx, identity)).status, "not_found");
  assert.deepEqual(calls, []);
});

test("reentrant cell or operation replacement never aborts the replacement", async () => {
  for (const replace of [
    (ctx) => { ctx.active = operation("operation-new"); },
    (ctx) => { ctx.kernel.getSnapshot = () => ({ kernelId: "kernel-a", activeCells: [{ ...identity, cellId: "cell-new" }] }); },
  ]) {
    const { ctx, calls } = fixture();
    ctx.kernel.interruptCell = () => { calls.push("interrupt"); replace(ctx); return true; };
    assert.equal((await interruptCell(ctx, identity)).status, "requested");
    assert.deepEqual(calls, ["interrupt"]);
  }
});

test("a new operation admitted during queue clearing does not inherit native abort", async () => {
  const { ctx, calls } = fixture();
  ctx.session.clearQueue = () => {
    calls.push("queue");
    ctx.active = operation("operation-new");
    return { steering: [], followUp: [] };
  };
  assert.equal((await interruptCell(ctx, identity)).status, "requested");
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"], "ui", "queue"]);
  assert.equal(ctx.active.cancelled, false);
});

test("explicitly selecting a live cell with peers still stops the native round without closing peer asks", async () => {
  const { ctx, calls } = fixture();
  const peer = { ...identity, cellId: "cell-b" };
  let activeCells = [identity, peer];
  ctx.kernel.getSnapshot = () => ({ kernelId: identity.kernelId, activeCells });
  ctx.kernel.interruptCell = (kernelId, cellId, reason) => {
    calls.push([kernelId, cellId, reason]);
    activeCells = [peer];
    return true;
  };
  ctx.options.extensionUi.cancel = (scope) => calls.push(["ui", scope]);
  assert.deepEqual(await interruptCell(ctx, identity), {
    ...identity, status: "requested", returnedMessages: ["queued steer", "queued follow-up"],
  });
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"], ["ui", "operation"], "queue", "handlers", "abort"]);
  assert.equal(ctx.active, undefined);
});

test("a pending receipt does not select a native round while other cells are live", async () => {
  const { ctx, calls } = fixture();
  ctx.kernel.getSnapshot = () => ({ kernelId: identity.kernelId, activeCells: [{ ...identity, cellId: "cell-b" }] });
  assert.deepEqual(await interruptCell(ctx, identity), { ...identity, status: "requested", returnedMessages: [] });
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"]]);
});

test("cell-only cancellation never drains native queues", async () => {
  const { ctx, calls } = fixture();
  assert.deepEqual(await interruptCell(ctx, { ...identity, cellOnly: true }), { ...identity, status: "requested", returnedMessages: [] });
  assert.deepEqual(calls, [["kernel-a", "cell-a", "user"]]);
});
