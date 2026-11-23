import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function observeProcesses(fixture, pids, { gone = false } = {}) {
  const ids = [...new Set(pids)].filter((pid) => Number.isSafeInteger(pid) && pid > 0);
  assert.ok(ids.length);
  let observed = "";
  for (let attempt = 0; attempt < (gone ? 100 : 1); attempt++) {
    observed = await fixture.observe(`ps -o pid=,ppid=,pgid=,stat=,args= -p ${ids.join(",")}\ntrue\n`);
    if (!gone || !observed.trim()) break;
    await delay(50);
  }
  if (gone) assert.equal(observed.trim(), "", `Owned processes remain: ${observed}`);
  return observed.trim();
}
