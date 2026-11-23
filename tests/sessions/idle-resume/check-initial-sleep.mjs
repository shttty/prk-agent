import { readFile } from "node:fs/promises";
import { assertProcessExited } from "../../fixtures/target-environment/assert-process-exited.mjs";
import assert from "node:assert/strict";

export async function checkInitialSleep({ host, tempRoot, complete, send, snapshot, get, until, pidFile }) {
  const main = (await host.createSession({ target: "local", label: "Idle coordinator" })).session.sessionId;
  await complete(await send(main, "BEFORE_SLEEP"));
  const mainId = snapshot(main).sessionId;
  const worker = (await host.createSession({ target: "local", cwd: tempRoot, label: "Idle worker" })).session.sessionId;
  await complete(await send(worker, "SEED_PYTHON"));
  const workerId = snapshot(worker).sessionId;
  const activeWorkerStreamId = snapshot(worker).streamId;
  const originalKernelId = get(worker).kernel?.kernelId;
  assert.ok(originalKernelId);
  await until(() => get(main)?.state === "sleeping" && get(worker)?.state === "sleeping", "main and worker sleep without ending identity");
  assert.equal(snapshot(main).sessionId, mainId);
  assert.equal(snapshot(worker).sessionId, workerId);
  const dormantWorkerStreamId = snapshot(worker).streamId;
  assert.equal(typeof dormantWorkerStreamId, "string");
  assert(dormantWorkerStreamId.length > 0);
  assert.notEqual(dormantWorkerStreamId, activeWorkerStreamId, "sleep retires the runtime's counter lifetime");
  await assertProcessExited(Number(await readFile(pidFile, "utf8")));
  return { main, sessionId: worker, mainId, workerId, dormantWorkerStreamId, originalKernelId };
}
