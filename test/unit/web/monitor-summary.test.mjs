import assert from "node:assert/strict";
import test from "node:test";
import { rowState } from "../../../web/sessions/sidebar/labels/row-state.js";
import { childrenSummary } from "../../../web/monitor/readings/children-summary.js";
import { processSummary } from "../../../web/monitor/readings/process-summary.js";

const summarize = (rows) => childrenSummary(rows.map((row) => ({ state: rowState(row) })));
const process = (pid, depth, ownership, cpuPercent, rssBytes) => ({ pid, depth, ownership, cpuPercent, rssBytes, command: "x", kind: "kernel" });

test("child summary is one line in sidebar priority, states with none left out", () => {
  const { counts, text } = summarize([{ state: "running" }, { state: "running", compacting: true }, { state: "idle", stopped: true },
    { state: "idle", derivation: { phase: "delivered" } }, { state: "starting" }, { state: "running", blocked: true }, { state: "idle", background: true }]);
  assert.equal(text, "1 等待 · 1 出错 · 3 运行中 · 1 后台运行 · 1 已交付");
  assert.deepEqual([counts.running, counts.delivered], [3, 1]);
  assert.equal(summarize([{ state: "running" }, { state: "idle", derivation: { phase: "submitted" } }, { state: "idle", derivation: { phase: "delivered" } }]).text,
    "1 运行中 · 2 已交付");
  assert.equal(summarize([{ state: "idle", derivation: { phase: "delivered" } }]).text, "1 已交付");
});

test("process summary totals the background processes in one line", () => {
  const summary = processSummary([process(1, 0, "root", 50, 900), process(2, 1, "infrastructure", 9, 900), process(3, 1, "detached", 7.4, 100 << 20),
    process(4, 2, "unknown", null, 40 << 20), process(5, 1, "detached", 5, 200 << 20)]);
  assert.deepEqual([summary.count, summary.detached, Math.round(summary.cpuPercent)], [3, 2, 12]);
  assert.equal(summary.text, "3 · 2 脱管 · CPU 12%");
  assert.equal(processSummary([process(3, 1, "managed", null, 1 << 20)], true).text, "1+ · CPU —");
});
