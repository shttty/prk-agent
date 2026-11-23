// The page's hold on an instance's remote environment (web/workbench/payloads/normalize-environment.js and
// web/workbench/store/targets/*): which snapshot wins (docs/wire/targets.md, 实例环境下发: within one Gateway stream only
// a newer revision; a new stream replaces), and that every path into the store (collection event, POST answer, HTTP
// workbench answer, stream snapshot, ENVIRONMENT_REQUIRED details) follows that one rule.
import assert from "node:assert/strict";
import { normalizeEnvironment } from "../../web/workbench/payloads/normalize-environment.js";
import { normalizeTarget } from "../../web/workbench/payloads/normalize-target.js";
import { newerEnvironment } from "../../web/workbench/store/targets/newer-environment.js";
import { applyTargetEnvironment } from "../../web/workbench/store/targets/apply-target-environment.js";
import { applyWorkbenchSnapshot } from "../../web/workbench/store/workbench-snapshot/apply-workbench-snapshot.js";
import { initialState } from "../../web/workbench/store/initial-state.js";

const snapshot = (streamId, revision, status, extra = {}) => ({ target: "office", streamId, revision, status, transferredBytes: 0, totalBytes: 0, percent: 0, bytesPerSecond: 0, ...extra });

// Shape: the Gateway's numbers pass through; malformed snapshots are dropped, not guessed.
assert.deepEqual(normalizeEnvironment(snapshot("s1", 4, "transferring", { transferredBytes: 512, totalBytes: 2048, percent: 25, bytesPerSecond: 128 })),
  snapshot("s1", 4, "transferring", { transferredBytes: 512, totalBytes: 2048, percent: 25, bytesPerSecond: 128 }));
assert.equal(normalizeEnvironment(snapshot("s1", 1, "starting")), null, "unknown status");
assert.equal(normalizeEnvironment({ ...snapshot("s1", 1, "idle"), streamId: undefined }), null, "no stream identity");
assert.equal(normalizeEnvironment({ ...snapshot("s1", 1.5, "idle") }), null, "revision must be an integer");
assert.deepEqual(normalizeEnvironment(snapshot("s1", 2, "failed", { error: { code: "TARGET_UNREACHABLE", message: "lost", details: { reason: "connection" } } })).error,
  { code: "TARGET_UNREACHABLE", message: "lost", details: { reason: "connection" } });
assert.equal(normalizeTarget({ id: "office", environment: snapshot("s1", 1, "ready") }).environment.status, "ready");
assert.equal(Object.hasOwn(normalizeTarget({ id: "office", environment: { status: "ready" } }), "environment"), false);

// Ordering: same stream → higher revision only; another stream → replaces whatever revision it carries.
const r5 = snapshot("s1", 5, "transferring");
assert.equal(newerEnvironment(r5, snapshot("s1", 3, "checking")), r5, "an older answer never overwrites a newer event");
assert.equal(newerEnvironment(r5, snapshot("s1", 6, "ready")).revision, 6);
assert.equal(newerEnvironment(r5, snapshot("s2", 1, "idle")).streamId, "s2", "a restarted Gateway's stream replaces the old progress");
assert.equal(newerEnvironment(null, r5).revision, 5);
assert.equal(newerEnvironment(r5, null), r5);

// A terminal state followed within milliseconds by idle is still known: `settled` keeps the stream's last ready/failed.
const readyThenIdle = newerEnvironment(newerEnvironment(r5, snapshot("s1", 8, "ready")), snapshot("s1", 9, "idle"));
assert.deepEqual([readyThenIdle.status, readyThenIdle.settled], ["idle", snapshot("s1", 8, "ready")]);
const failedThenIdle = newerEnvironment(newerEnvironment(r5, snapshot("s1", 8, "failed", { error: { code: "TARGET_UNREACHABLE", message: "lost" } })), snapshot("s1", 9, "idle"));
assert.deepEqual(failedThenIdle.settled, snapshot("s1", 8, "failed", { error: { code: "TARGET_UNREACHABLE", message: "lost" } }));
assert.equal(Object.hasOwn(newerEnvironment(readyThenIdle, snapshot("s1", 10, "ready")).settled, "settled"), false, "settled never nests");
assert.equal(newerEnvironment(readyThenIdle, snapshot("s2", 1, "idle")).settled, undefined, "a new stream knows nothing of the old one's outcome");

// Store paths: event/POST merge and a later HTTP workbench answer carrying an older revision.
const ctx = { state: initialState(), listeners: new Set(), disposed: false, displayNotifyCancel: null, draftRevision: 0 };
const workbench = (environment) => ({ targets: [{ id: "office", label: "Office", environment }, { id: "local", label: "Local", local: true }], sessions: [] });
applyWorkbenchSnapshot(ctx, workbench(snapshot("s1", 2, "checking")));
assert.equal(ctx.state.targets[0].environment.revision, 2);
assert.equal(applyTargetEnvironment(ctx, normalizeEnvironment(snapshot("s1", 7, "transferring", { transferredBytes: 10, totalBytes: 40, percent: 25, bytesPerSecond: 5 }))).revision, 7);
applyWorkbenchSnapshot(ctx, workbench(snapshot("s1", 4, "checking")));
assert.equal(ctx.state.targets[0].environment.revision, 7, "an HTTP workbench answer does not roll the environment back");
assert.equal(ctx.state.targets[1].environment, undefined, "an instance without a snapshot stays without one");
assert.equal(applyTargetEnvironment(ctx, normalizeEnvironment(snapshot("s1", 6, "ready"))).revision, 7, "a late event is ignored");
applyWorkbenchSnapshot(ctx, workbench(snapshot("s2", 1, "idle")));
assert.deepEqual([ctx.state.targets[0].environment.streamId, ctx.state.targets[0].environment.status], ["s2", "idle"], "a new stream's first frame replaces");
assert.equal(applyTargetEnvironment(ctx, normalizeEnvironment({ ...snapshot("s2", 9, "ready"), target: "gone" })), null, "unknown instances are ignored");
assert.equal(ctx.state.workbenchLinkLosses, 0);
console.log("PASS target environment logic: normalization, stream/revision ordering, every store path keeps the newer snapshot");
