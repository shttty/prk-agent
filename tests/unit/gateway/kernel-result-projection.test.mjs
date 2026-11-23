import assert from "node:assert/strict";
import test from "node:test";
import { kernelResult } from "../../../src/gateway/session-views/history/read-kernel-result.ts";
import { archivedSnapshot } from "../../../src/gateway/session-views/snapshots/format-archived-snapshot.ts";
import { decorateSnapshot } from "../../../src/gateway/session-views/snapshots/format-active-snapshot.ts";
import { projectToolDetails } from "../../../src/gateway/tool-content/format-details.ts";
import { projectMessage } from "../../../src/gateway/tool-content/projection/format-message.ts";
import { DEFAULT_HTTP_OPTIONS as http } from "../../../src/config/http/http-options.ts";
import { DEFAULT_LIMITS_OPTIONS as limits } from "../../../src/config/limits/limits-options.ts";
import { retainUnsavedCell } from "../../../src/sessions/history/kernel-cells/retain-unsaved-cell.ts";
import { projectKernelCellEvent } from "../../../src/gateway/session-hosts/subscription/format-kernel-cell-event.ts";

const sessionId = "session-a", cellId = "01234567-89ab-4cde-8fab-0123456789ab";
const identity = { kernelId: "kernel-a", cellId, toolCallId: "tool-a", startedAt: 100 };
const open = { ...identity, version: 1, sessionId };
const images = [{ type: "image", mimeType: "image/png", data: "first-image" }, { type: "image", mimeType: "image/png", data: "second-image" }];
const text = { type: "text", text: "saved output" };
const result = { content: [text, ...images], details: { target: "local", outcome: "ok", truncated: false, rawOutput: "raw output" } };
const receipt = { ...open, outcome: "ok", finishedAt: 200, result };
const openEntry = { type: "custom", customType: "kernel-cell-open", data: open };
const resultEntry = { type: "custom", customType: "kernel-cell-result", data: receipt };
const deliveredEntry = { type: "custom_message", customType: "kernel-event", details: { ...identity, sessionId, kind: "finished", eventId: `${cellId}:finished` } };
const options = { maxBytes: 8192, maxLines: 40 };

function manager(branch) {
  return { getSessionId: () => sessionId, getLeafId: () => branch.at(-1)?.id ?? null, getBranch: () => branch, getEntries: () => branch,
    buildSessionContext: () => ({ messages: [], model: null }) };
}
function context(branch, flags = {}) {
  const entry = { sessionId, target: "local", manager: manager(branch), ...flags };
  return { entry, ctx: {
    host: { history: { get: (id) => id === sessionId ? entry : undefined }, collection: { get: () => undefined }, config: { limits, http, toolContent: options, session: {} } },
    models: { modelFallbacks: new Map() }, instances: { targets: [] }, capabilities: { capabilityDefaults: {} },
    methods: { archivedStream: () => ({ streamId: "archived" }), messageEntryIds: () => [], storedSession: () => entry },
  } };
}

test("saved results return delivery metadata and text by default, one image only on explicit read", () => {
  const { ctx } = context([openEntry, resultEntry], { archived: { at: 300 } });
  const summary = kernelResult(ctx, sessionId, cellId);
  assert.equal(summary.delivery, "unconfirmed");
  assert.equal(summary.imageCount, 2);
  assert.deepEqual(summary.result, { ...result, content: [text] });
  assert.deepEqual(kernelResult(ctx, sessionId, cellId, 2).result, { ...result, content: [text, images[1]] });
  assert.deepEqual(result.content, [text, ...images]);
  assert.throws(() => kernelResult(ctx, sessionId, cellId, 3), { code: "NOT_FOUND" });
  assert.throws(() => kernelResult(ctx, sessionId, "not-in-branch"), { code: "NOT_FOUND" });
  assert.throws(() => kernelResult(ctx, "another-session", cellId), { code: "NOT_FOUND" });
});

test("result reads use the owning active native branch without waking or displacing it", () => {
  const { ctx } = context([openEntry]);
  const liveManager = manager([openEntry, resultEntry, deliveredEntry]);
  ctx.host.collection.get = () => ({ session: { sessionManager: liveManager }, kernel: { getSnapshot: () => ({ activeCells: [identity] }) } });
  assert.equal(kernelResult(ctx, sessionId, cellId).delivery, "delivered");
  liveManager.getBranch = () => [openEntry];
  assert.equal(kernelResult(ctx, sessionId, cellId).delivery, "running");
  assert.equal(kernelResult(ctx, sessionId, cellId).result, undefined);
  assert.throws(() => kernelResult(ctx, sessionId, cellId, 1), { code: "NOT_FOUND" });
  liveManager.getBranch = () => [];
  assert.throws(() => kernelResult(ctx, sessionId, cellId), { code: "NOT_FOUND" });
});

test("archived and active snapshots attach only nonempty metadata-only kernelCells", () => {
  const { ctx, entry } = context([openEntry, resultEntry], { sleeping: true });
  const saved = archivedSnapshot(ctx, entry);
  assert.equal(saved.kernelCells[0].delivery, "unconfirmed");
  assert.equal(saved.kernelCells[0].imageCount, 2);
  assert.equal("result" in saved.kernelCells[0], false);
  assert.equal(JSON.stringify(saved.kernelCells).includes("first-image"), false);
  entry.manager = manager([]);
  assert.equal("kernelCells" in archivedSnapshot(ctx, entry), false);
  const activeManager = manager([openEntry]);
  const runtime = { session: { sessionManager: activeManager, messages: [], scopedModels: [], getContextUsage: () => null } };
  ctx.host.collection.get = () => runtime;
  const snapshot = { sessionId, streamId: "live", sequence: 1, state: "idle", messages: [], queuedMessages: { steering: [], followUp: [] }, kernel: { state: "busy", activeCells: [identity] } };
  assert.equal(decorateSnapshot(ctx, sessionId, snapshot).kernelCells[0].delivery, "running");
  activeManager.getBranch = () => [];
  assert.equal("kernelCells" in decorateSnapshot(ctx, sessionId, snapshot), false);
});

test("kernel-event Gateway projections omit image blocks and frozen details within existing preview budgets", () => {
  const event = { role: "custom", customType: "kernel-event", display: true, content: [text, ...images],
    details: { ...identity, sessionId, kind: "finished", imageCount: 2, resultDetails: result.details } };
  const projected = projectMessage(event, options);
  assert.deepEqual(projected.content, [text]);
  assert.equal(projected.details.imageCount, 2);
  assert.equal("resultDetails" in projected.details, false);
  assert.deepEqual(event.content, [text, ...images]);
  assert.equal(event.details.resultDetails, result.details);
  const large = projectMessage({ ...event, content: [{ type: "text", text: "line\n".repeat(100) }, ...images] }, { maxBytes: 100, maxLines: 3 });
  assert.ok(large.outputPreview);
  assert.ok(Buffer.byteLength(large.content[0].text) <= 100);
  assert.ok(large.content[0].text.split("\n").length <= 3);
  assert.equal(JSON.stringify(large).includes("first-image"), false);
  assert.equal(projectMessage({ ...event, customType: "other-event" }, options).content, event.content);
});

test("failed result persistence remains readable without claiming a durable result", () => {
  const { ctx, entry } = context([openEntry]);
  retainUnsavedCell(entry.manager, receipt);
  const view = kernelResult(ctx, sessionId, cellId, 1);
  assert.equal(view.delivery, "unsaved");
  assert.deepEqual(view.result, { ...result, content: [text, images[0]] });
});

test("cell metadata distinguishes transient finished events from native no-wake receipts", () => {
  const branch = [openEntry, resultEntry];
  const { ctx } = context(branch);
  ctx.host.collection.get = () => ({ session: { sessionManager: manager(branch) }, kernel: { getSnapshot: () => ({ state: "idle", activeCells: [] }) } });
  const binding = { parent: ctx, sessionId };
  const message = { role: "custom", customType: "kernel-event", details: { ...deliveredEntry.details, outcome: "ok" } };
  const event = { type: "session_event", sessionId, streamId: "live", sequence: 2, details: { sdkType: "message_end", message } };
  assert.equal(projectKernelCellEvent(binding, event).details.kernelCells[0].delivery, "unconfirmed");
  branch.push(deliveredEntry);
  assert.equal(projectKernelCellEvent(binding, event).details.kernelCells[0].delivery, "delivered", "no-wake message_end follows native append");
  const settled = { ...event, details: { sdkType: "agent_settled" } };
  assert.equal(projectKernelCellEvent(binding, settled).details.kernelCells[0].delivery, "delivered", "autonomous wake-path receipt is re-read after the native append");
  const sibling = { ...identity, cellId: "01234567-89ab-4cde-8fab-0123456789ac", toolCallId: "tool-b" };
  branch.push({ ...openEntry, data: { ...open, ...sibling } });
  const telemetry = { ...event, type: "state_changed", details: { kernel: { state: "busy", activeCells: [identity, sibling] } } };
  assert.deepEqual(projectKernelCellEvent(binding, telemetry).details.kernelCells.map(({ delivery }) => delivery), ["delivered", "running"]);
  const next = { ...telemetry, sequence: 3, details: { kernel: { state: "busy", activeCells: [sibling] } } };
  assert.deepEqual(projectKernelCellEvent(binding, next).details.kernelCells.map(({ delivery }) => delivery), ["delivered", "running"], "settling A must publish receipts even while B remains live");
  const outputTick = { ...next, sequence: 4 };
  assert.equal(projectKernelCellEvent(binding, outputTick), outputTick, "output ticks do not rescan native history");
});

test("native branch summaries retain only the latest fully identified reminder metadata", () => {
  const checkpoint = { ...deliveredEntry, details: { ...identity, sessionId, kind: "checkpoint", eventId: `${cellId}:checkpoint:1`, step: 1,
    elapsedMs: 150, activeMs: 100, nextInMs: 500, output: "not-in-metadata", content: images } };
  const wrong = { ...checkpoint, details: { ...checkpoint.details, toolCallId: "other-tool", step: 2, eventId: `${cellId}:checkpoint:2` } };
  const { ctx } = context([openEntry, checkpoint, wrong, resultEntry]);
  const summary = kernelResult(ctx, sessionId, cellId);
  assert.deepEqual(summary.lastCheckpoint, { ...identity, sessionId, eventId: checkpoint.details.eventId, step: 1, elapsedMs: 150, activeMs: 100, nextInMs: 500 });
  assert.equal(JSON.stringify(summary.lastCheckpoint).includes("not-in-metadata"), false);
  assert.equal(JSON.stringify(summary.lastCheckpoint).includes("first-image"), false);
});


test("increment images are fetched via history or tool content, not emitted in message or preview bodies", () => {
  const user = { role: "user", content: [text, images[0]] };
  assert.deepEqual(projectToolDetails({ sdkType: "message_end", message: user }, options).message.content, [text]);
  assert.deepEqual(projectMessage(user, options).content, [text, images[0]], "explicit history reads retain user images");
  const imageOutput = { content: [images[0]], details: {} };
  const detail = projectToolDetails({ sdkType: "tool_execution_end", result: imageOutput }, options);
  assert.equal(typeof detail.outputPreview.version, "string", "even a small image has a lazy tool content reference");
  assert(!JSON.stringify(detail).includes("first-image"));
});
