import { setTimeout as sleep } from "node:timers/promises";

export async function waitForAskState(read, check, label, timeoutMs = 10_000) {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (check(value)) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await sleep(20);
  }
}
