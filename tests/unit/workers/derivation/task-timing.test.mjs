import assert from "node:assert/strict";
import { test } from "node:test";
import { readTaskTiming } from "../../../../src/sessions/derivation/read-task-timing.ts";

const task = {
  createdBy: "parent", owner: "parent", taskId: "task-one", task: "Inspect one input",
  lifecycle: "persistent", phase: "working", model: "faux/controlled", thinkingLevel: "off",
  startedAt: 1767225600000,
};

test("unfinished child omits finishedAt rather than publishing null", () => {
  const row = readTaskTiming(task);
  assert.deepEqual(row, { startedAt: 1767225600000 });
  assert.equal(Object.hasOwn(row, "finishedAt"), false);
});

test("submitted result stops elapsed time before a later archive", () => {
  const submitted = { ...task, phase: "submitted", result: {
    id: "result-one", summary: "Verified", artifacts: [], startedAt: 1767225600000, finishedAt: 1767225601000,
  } };
  assert.deepEqual(readTaskTiming(submitted, "2026-01-01T00:00:05.000Z"), {
    startedAt: 1767225600000, finishedAt: 1767225601000,
  });
});

test("ending a child without a result uses the authoritative archive time", () => {
  assert.deepEqual(readTaskTiming(task, "2026-01-01T00:00:05.123Z"), {
    startedAt: 1767225600000, finishedAt: 1767225605123,
  });
});
