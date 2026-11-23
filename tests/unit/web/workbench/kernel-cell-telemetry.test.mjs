import assert from "node:assert/strict";
import test from "node:test";
import { handleHostEvent } from "../../../../web/workbench/store/session-stream/handle-host-event.js";

const identity = { kernelId: "kernel-a", cellId: "cell-a", toolCallId: "tool-a", startedAt: 100 };

test("cell telemetry respects stream and sequence without invalidating extension rendering", () => {
  const snapshot = { sessionId: "session-a", streamId: "stream-a", sequence: 10, kernel: { state: "busy", kernelId: identity.kernelId, activeCell: identity } };
  const ctx = { state: { session: { streamId: snapshot.streamId, lastSequence: 10, transcriptRevision: 5, snapshot } }, displayNotifyCancel() {} };
  const host = (sequence, details, values = {}) => ({ type: "state_changed", sessionId: snapshot.sessionId, streamId: snapshot.streamId, sequence, details, ...values });
  const activeCell = { ...identity, output: "latest", elapsedMs: 300, activeMs: 200, waitingForAsk: true, truncated: false, imageCount: 0 };
  handleHostEvent(ctx, host(11, { kernel: { state: "busy", kernelId: identity.kernelId, activeCell } }));
  assert.equal(ctx.state.session.snapshot.kernel.activeCell, activeCell);
  assert.equal(ctx.state.session.lastSequence, 11);
  assert.equal(ctx.state.session.snapshot.sequence, 10);
  assert.equal(ctx.state.session.transcriptRevision, 5);
  const current = ctx.state.session.snapshot;
  for (const event of [host(11, { kernel: {} }), host(9, { kernel: {} }), host(12, { kernel: {} }, { streamId: "retired" }), host(12, { kernel: {} }, { sessionId: "other" })]) handleHostEvent(ctx, event);
  assert.equal(ctx.state.session.snapshot, current);
  const kernelCells = [{ ...identity, delivery: "unconfirmed", outcome: "unknown", notice: "saved reason", imageCount: 1 }];
  handleHostEvent(ctx, host(12, { kernel: { state: "idle", kernelId: identity.kernelId }, kernelCells }));
  assert.equal(ctx.state.session.snapshot.kernel.activeCell, undefined);
  assert.equal(ctx.state.session.snapshot.kernelCells, kernelCells);
  assert.equal(ctx.state.session.snapshot.sequence, 10);
  assert.equal(ctx.state.session.transcriptRevision, 5);
});
