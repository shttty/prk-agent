import assert from "node:assert/strict";
import test from "node:test";
import { classifyProcesses } from "../../../src/monitor/session-monitor/telemetry/classify-processes.ts";

const proc = (pid, parentPid, group = pid, foregroundGroup = -1) => ({ pid, parentPid, group, foregroundGroup, command: `proc-${pid}`, cpuPercent: 0, rssBytes: 4096 });

test("only known process owners suppress the detached marker", () => {
  const rows = [proc(1, 0), proc(2, 1), proc(3, 1), proc(4, 3), proc(10, 0, 10, 11), proc(11, 10, 11), proc(12, 10, 12)];
  const kernel = { kind: "kernel", pid: 1, infrastructurePid: 2, running: false };
  const terminal = { kind: "terminal", pid: 10, running: true };
  const projection = (roots) => classifyProcesses(rows, roots).map(({ pid, ownership, depth }) => [pid, ownership, depth]);
  assert.deepEqual(projection([kernel, terminal]), [
    [1, "root", 0], [2, "infrastructure", 1], [3, "detached", 1], [4, "detached", 2],
    [10, "root", 0], [11, "managed", 1], [12, "detached", 1],
  ]);
  assert.deepEqual(projection([{ ...kernel, running: true }]).slice(2), [[3, "unknown", 1], [4, "unknown", 2]]);
  assert.deepEqual(projection([{ ...terminal, running: false }]).slice(1), [[11, "detached", 1], [12, "detached", 1]]);
});
