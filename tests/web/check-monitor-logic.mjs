// Pure monitor-card logic: stamping and ages, row/icon flags, formatting, memory readings, unified diff parsing.
import assert from "node:assert/strict";
import { alertsOf } from "../../web/monitor/readings/alerts-of.js";
import { deltaLabel } from "../../web/monitor/readings/delta-label.js";
import { formatBytes } from "../../web/monitor/readings/format-bytes.js";
import { kernelMemory } from "../../web/monitor/readings/kernel-memory.js";
import { limitBytes } from "../../web/monitor/readings/limit-bytes.js";
import { machineMemory } from "../../web/monitor/readings/machine-memory.js";
import { parseUnifiedDiff } from "../../web/workspace/diff-view/parse-unified-diff.js";
import { sampleAgeSeconds } from "../../web/monitor/readings/sample-age-seconds.js";
import { stampMonitor } from "../../web/monitor/readings/stamp-monitor.js";
import { normalizeSession } from "../../web/workbench/payloads/normalize-session.js";
import { parseDiff } from "../../web/chat/tool-text/parse-diff.js";

// ages keep counting from when the frame arrived
const stamped = stampMonitor({ machine: { ageMs: 4000 } }, 1_000_000);
assert.equal(stamped.receivedAt, 1_000_000);
assert.equal(sampleAgeSeconds(stamped, stamped.machine, 1_000_000), 4);
assert.equal(sampleAgeSeconds(stamped, stamped.machine, 1_006_400), 10);
assert.equal(sampleAgeSeconds(stamped, undefined, 1_000_000), null, "no sample, no age");
assert.equal(sampleAgeSeconds(stamped, stamped.machine, 900_000), 4, "a clock stepping back never gives a negative age");
assert.equal(stampMonitor("nope"), undefined);
const workerRow = { label: "worker", sessionId: "w", state: "idle", target: "alpha", cwd: "/data" };
assert.equal(normalizeSession({ ...workerRow, monitor: { state: "ok" } }).monitor.state, "ok");
assert.equal(typeof normalizeSession({ ...workerRow, monitor: { state: "ok" } }).monitor.receivedAt, "number", "workbench rows are stamped on arrival");
assert.equal("monitor" in normalizeSession({ ...workerRow, monitor: "garbage" }), false);

// alerts and +N
const row = (monitor) => ({ monitor });
assert.deepEqual(alertsOf(row({ alerts: { kernel: false, oom: false, memory: false } })), { kernel: false, oom: false, memory: false, any: false });
assert.equal(alertsOf(row({ alerts: { kernel: false, oom: true, memory: false } })).any, true);
assert.equal(alertsOf(row({ alerts: { memory: true } })).any, true);
assert.equal(alertsOf({}).any, false);
const changes = (added, removed, files = 1) => row({ changes: { added, removed, files: Array.from({ length: files }, () => ({})) } });
assert.equal(deltaLabel(changes(12, 3)), "+12");
assert.equal(deltaLabel(changes(1500, 0)), "+1.5k");
assert.equal(deltaLabel(changes(25000, 0)), "+25k");
assert.equal(deltaLabel(changes(0, 7)), "-7", "only deletions show the removed count");
assert.equal(deltaLabel(changes(0, 0, 1)), "±", "a changed file with no counted lines (binary, mode) still shows");
assert.equal(deltaLabel(changes(0, 0, 0)), null, "clean means nothing beside the icon");
assert.equal(deltaLabel(row({})), null);

// formatting and memory
assert.equal(formatBytes(0), "0 B");
assert.equal(formatBytes(1536), "1.5 KB");
assert.equal(formatBytes(3.5 * 1024 ** 3), "3.5 GB");
assert.equal(formatBytes(250 * 1024 ** 2), "250 MB");
assert.equal(formatBytes(NaN), "—");
assert.equal(limitBytes("4G"), 4 * 1024 ** 3);
assert.equal(limitBytes("512"), 512);
assert.equal(limitBytes("4GB"), null);
assert.equal(limitBytes("infinity"), null);
const GB = 1024 ** 3;
assert.deepEqual(kernelMemory({ memory: { current: 3 * GB, workingSet: 3 * GB, memoryMax: "4G", oomKill: 2 } }), { used: 3 * GB, limit: 4 * GB, percent: 75, oomKill: 2 });
assert.equal(kernelMemory({ memory: { current: GB, workingSet: GB, memoryMax: "weird" } }).percent, null, "an unreadable limit gives no percentage, not NaN");
assert.equal(kernelMemory({}), null);
assert.deepEqual(machineMemory({ mem: { total: 100, available: 25 } }), { used: 75, total: 100, percent: 75 });
assert.equal(machineMemory({}), null);

// unified diff -> DiffBlock rows
const unified = [
  "diff --git a/f.py b/f.py", "index 1..2 100644", "--- a/f.py", "+++ b/f.py",
  "@@ -1,3 +1,4 @@", " keep", "-old", "+new", "+added", " tail",
  "@@ -20,2 +21,2 @@ def far():", "-x", "+y", " z",
  "\\ No newline at end of file", "",
].join("\n");
const parsed = parseUnifiedDiff(unified);
assert.deepEqual(parsed.rows.map((r) => [r.kind, r.label, r.text]), [
  ["ctx", "1", "keep"], ["del", "-2", "old"], ["add", "+2", "new"], ["add", "+3", "added"], ["ctx", "4", "tail"],
  ["gap", "…", ""],
  ["del", "-20", "x"], ["add", "+21", "y"], ["ctx", "22", "z"],
]);
assert.deepEqual([parsed.add, parsed.del, parsed.width], [3, 2, 3]);
assert.equal(parseUnifiedDiff("diff --git a/b.bin b/b.bin\nBinary files differ\n"), null, "no hunk, nothing to draw");
assert.equal(parseUnifiedDiff(""), null);
const two = parseUnifiedDiff("diff --git a/a b/a\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/c b/c\n--- a/c\n@@ -5 +5 @@\n-c\n+d\n");
assert.equal(two.rows.filter((r) => r.kind === "gap").length, 1, "hunks join with a gap");
// the agent's edit rows go through the existing parser unchanged
const agent = parseDiff("+1 a\n+2 B\n-2 b\n \n 5 e\n");
assert.deepEqual([agent.add, agent.del, agent.rows.some((r) => r.kind === "gap")], [2, 1, true]);
console.log("PASS monitor logic: ages, flags, +N, formatting, memory, unified diff rows");
