import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { assembleFiles } from "../../../src/workspace/target-files/assemble-files.ts";
import { readBytes } from "../../../src/workspace/target-files/read-bytes.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";

export async function checkLifecycle(fixture, options, context) {
  const lease = fixture.sentinel;
  const path = `${fixture.root}/growth`;
  await fixture.observe(`printf x > ${quoteShell(path)}\n`);
  const opened = await lease.connection.request("open", { path, noFollow: false });
  assert.equal(opened.json.info.size, 1);
  await fixture.observe(`printf 123456789 > ${quoteShell(path)}\n`);
  try {
    await assert.rejects(readBytes({ connection: lease.connection, requestOptions: { session: opened.session }, options }, opened, 4), { code: "TOO_LARGE" });
  } finally { await lease.connection.request("close", { handle: opened.json.handle }, { session: opened.session }); }
  const bounded = assembleFiles({ ...options, workspace: { ...options.workspace, fileRequestsMax: 1 }, targetConnection: { ...options.targetConnection, requestTimeoutMs: 100 } });
  const pid = lease.info.pid;
  await fixture.observe(`kill -STOP ${pid}\n`);
  const first = bounded.list(context);
  const outcome = assert.rejects(first, { code: "UNKNOWN" });
  await delay(20);
  await assert.rejects(bounded.list(context), { code: "BUSY" });
  await delay(150);
  await fixture.observe(`kill -CONT ${pid} 2>/dev/null || true\n`);
  await outcome;
  assert.equal(lease.signal.aborted, true);
  const next = await fixture.environments.acquire("owned");
  try {
    assert.notEqual(next.generation, lease.generation);
    await lease.retire(new Error("late old-owner retirement"));
    assert.equal(next.signal.aborted, false);
    const result = await next.connection.request("lstat", { path });
    assert.equal(result.json.size, 9);
  } finally { await next.release(); }
  console.log(JSON.stringify({ check: "growth-deadline-retirement", status: "PASS", retiredPid: pid }));
}
