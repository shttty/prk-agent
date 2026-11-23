import assert from "node:assert/strict";
import { observeLiveHost } from "../fixtures/host-live-observer.mjs";

function fixture(id = "operation") {
  const listeners = new Set();
  const completion = Promise.withResolvers();
  let snapshot = { streamId: `observer-${id}`, state: "running", operation: { operationId: id }, messages: [], recentOperations: [] };
  const host = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return { snapshot, unsubscribe: () => listeners.delete(listener) }; },
  };
  return {
    host, completion, submission: { accepted: true, operationId: id, completion: completion.promise },
    emit: (event) => { for (const listener of listeners) listener({ streamId: snapshot.streamId, ...event }); },
    update: (value) => { snapshot = { ...snapshot, ...value }; },
    listenerCount: () => listeners.size,
  };
}

async function check(action) {
  const f = fixture();
  const observer = observeLiveHost(f.host);
  try { await action(f, observer); }
  finally { observer.close(); assert.equal(f.listenerCount(), 0, "observer must detach after success/failure"); }
}

await check(async (f, observer) => {
  const started = Date.now();
  const waiting = observer.waitForMarker(f.submission, async () => false, 1_000, 5);
  setTimeout(() => {
    f.update({ messages: [{ role: "assistant", stopReason: "error", errorMessage: "Provider unavailable; token=SECRET42 Authorization: Bearer SECRET43 https://host/?token=SECRET44", content: [{ type: "text", text: "PRIVATE_HISTORY" }] }] });
    f.emit({ type: "state_changed", details: { kernel: { state: "idle", lastOutcome: "error" } } });
    f.emit({ type: "session_event", details: { sdkType: "tool_execution_end", toolName: "kernel_code", isError: true, args: { code: "PRIVATE_CODE" }, result: { content: [{ type: "text", text: "PRIVATE_TOOL_OUTPUT\nValueError: test failure\nPRIVATE_CODE\nPRIVATE_HISTORY" }], details: {} } } });
    f.emit({ type: "operation_completed", operationId: "operation", details: { operationId: "operation", status: "failed" } });
    f.completion.resolve({ operationId: "operation", status: "failed" });
  }, 10);
  await assert.rejects(waiting, (error) => {
    assert.match(error.message, /terminal host/i);
    assert.equal(error.diagnostics.model.stopReason, "error");
    assert.match(error.diagnostics.model.error, /Provider unavailable/);
    assert.equal(error.diagnostics.python.outcome, "error");
    assert.match(error.diagnostics.python.error, /ValueError/);
    for (const secret of ["SECRET42", "SECRET43", "SECRET44", "PRIVATE_CODE", "PRIVATE_HISTORY", "PRIVATE_TOOL_OUTPUT"]) assert(!error.message.includes(secret));
    assert(error.message.length < 4_096);
    assert.strictEqual(observer.failure(error), error, "harness catch must preserve captured terminal diagnostics");
    return true;
  });
  assert(Date.now() - started < 500, "late host failure must not wait for marker timeout");
});

for (const status of ["completed"]) {
  await check(async (f, observer) => {
    const waiting = observer.waitForMarker(f.submission, async () => false, 1_000, 5);
    f.completion.resolve({ operationId: "operation", status, error: status === "failed" ? "Provider request failed" : undefined });
    await assert.rejects(waiting, (error) => {
      assert.match(error.message, /terminal host/i);
      assert.equal(error.diagnostics.completion.status, status);
      return true;
    });
  });
}

await check(async (f, observer) => {
  const started = Date.now();
  await assert.rejects(observer.waitForMarker(f.submission, async () => false, 30, 2), /Timed out waiting for actual kernel side effect/);
  assert(Date.now() - started >= 20);
  assert(Date.now() - started < 300, "genuine marker timeout must stay bounded");
});
await check(async (f, observer) => {
  await assert.rejects(observer.waitForMarker(f.submission, () => new Promise(() => {}), 30, 2), /Timed out/);
});

await check(async (f, observer) => {
  let present = false;
  setTimeout(() => { present = true; }, 10);
  await observer.waitForMarker(f.submission, async () => present, 1_000, 5);
  // Cancellation is intentional AFTER the marker. Observing it must not throw
  // or turn a later operation into a marker failure.
  f.emit({ type: "operation_completed", operationId: "operation", details: { operationId: "operation", status: "unknown" } });
  f.completion.resolve({ operationId: "operation", status: "unknown" });
  assert.equal((await f.submission.completion).status, "unknown");
  f.update({ operation: { operationId: "next" } });
  const next = { accepted: true, operationId: "next", completion: new Promise(() => {}) };
  let nextPresent = false;
  setTimeout(() => { nextPresent = true; }, 10);
  await observer.waitForMarker(next, async () => nextPresent, 1_000, 5);
});

await check(async (f, observer) => {
  f.update({ state: "idle", operation: undefined, recentOperations: [{ operationId: "operation", status: "failed", error: "Late main failure" }] });
  const error = observer.failure(new Error("Original assertion failed"));
  assert.match(error.message, /Original assertion failed/);
  assert.equal(error.diagnostics.completion.status, "failed");
});
console.log("PASS: live-host observer handles real session/kernel events, late host terminals, completed-without-marker, bounded timeouts, success, intentional cancel, redaction and observer cleanup");
