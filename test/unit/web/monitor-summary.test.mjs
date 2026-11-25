import assert from "node:assert/strict";
import test from "node:test";
import { rowState } from "../../../web/sessions/sidebar/labels/row-state.js";
import { childrenSummary } from "../../../web/monitor/readings/children-summary.js";
import { processSummary } from "../../../web/monitor/readings/process-summary.js";

test("folded monitor sections summarize children by sidebar state and background processes by total", () => {
  const rows = [{ state: "running" }, { state: "running", compacting: true }, { state: "idle", blocked: true },
    { state: "idle", derivation: { phase: "delivered" } }, { state: "starting" }, { state: "idle", background: true }];
  assert.deepEqual(childrenSummary(rows.map((row) => ({ state: rowState(row) }))).map(({ key, count }) => [key, count]),
    [["blocked", 1], ["running", 3], ["background", 1], ["delivered", 1]]);
  const process = (pid, depth, ownership, cpuPercent, rssBytes) => ({ pid, depth, ownership, cpuPercent, rssBytes, command: "x", kind: "kernel" });
  assert.deepEqual(processSummary([process(1, 0, "root", 50, 900), process(2, 1, "infrastructure", 9, 900), process(3, 1, "detached", 7, 100),
    process(4, 2, "unknown", null, 40), process(5, 1, "detached", 5, 200)]), { count: 3, detached: 2, cpuPercent: 12, rssBytes: 340 });
  assert.equal(processSummary([process(3, 1, "managed", null, 1)]).cpuPercent, null);
});
