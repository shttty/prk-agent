import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function assertProcessExited(pid) {
  assert(Number.isSafeInteger(pid) && pid > 0, "Observe only a recorded owned process");
  const deadline = Date.now() + 10000;
  for (;;) {
    try { process.kill(pid, 0); }
    catch (error) { if (error.code === "ESRCH") return; throw error; }
    assert(Date.now() < deadline, `Owned process ${pid} did not exit`);
    await delay(25);
  }
}
