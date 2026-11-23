import assert from "node:assert/strict";

export async function finishWorkbench(handle, label) {
  assert.deepEqual(handle.problems.filter((problem) => !problem.startsWith("download failed (font-family")), [], `${label}: page errors`);
  await handle.context.close();
}
