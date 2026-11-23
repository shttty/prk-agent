import assert from "node:assert/strict";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";
import { createOwnedRuntime } from "./runtime-channel/create-owned-runtime.mjs";
import { awaitTargetFile } from "./runtime-channel/await-target-file.mjs";
import { observeProcesses } from "./runtime-channel/observe-processes.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";

assert(process.env.PI_TEST_PYTHON);
assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN);
const fixture = await createOwnedEnvironment({ prefix: "prk-S5-" });
const limits = parseProcessWindowLimits({ maxRequests: 1, maxBytes: 1048576, maxFrameBytes: 524288 });
const owned = await createOwnedRuntime(fixture, process.env.PI_TEST_PYTHON, 0);
let environment;
const channels = createTargetChannels({
  options: { startTimeoutMs: 10000, processWindow: limits },
  open: async (_, signal, processWindow) => {
    environment = await fixture.acquire("local");
    return { transport: await openProcessTransport(environment, owned.executable, fixture.root, signal, 10000, processWindow), command: "" };
  },
});
const first = channels.acquire("local");
let identity;
try {
  await first.request("monitor", "config", { intervalMs: 500 });
  identity = JSON.parse(await awaitTargetFile(fixture, `${owned.prefix}.json`));
  await fixture.observe(`kill -STOP ${identity.runtimePid}\n`);
  const pending = first.request("monitor", "config", { intervalMs: 501 });
  await assert.rejects(first.request("monitor", "config", { intervalMs: 502 }), { code: "BUSY" });
  await fixture.observe(`kill -CONT ${identity.runtimePid}\n`);
  await pending;
  await assert.rejects(first.request("monitor", "config", { payload: "x".repeat(limits.maxFrameBytes) }), { code: "FRAME_TOO_LARGE" });
  const sibling = await fixture.acquire("local");
  const old = environment;
  await fixture.observe(`kill -STOP ${identity.runtimePid}\n`);
  const path = `${fixture.root}/must-not-replay.txt`;
  const writing = first.request("files", "write", { cwd: fixture.root, path, content: "SIDE_EFFECT" })
    .then((value) => ({ value }), (error) => ({ error }));
  await assert.rejects(first.request("monitor", "config", {}), { code: "BUSY" });
  await old.retire(new Error("Owned file deadline expired"));
  assert(old.signal.aborted && sibling.signal.aborted);
  assert.equal((await writing).error?.code, "unknown", "Unconfirmed write must be unknown rather than replayed");
  await assert.rejects(first.request("monitor", "config", {}));
  await observeProcesses(fixture, [identity.pid, identity.child, old.info.pid], { gone: true });
  const fresh = await fixture.acquire("local");
  assert.notEqual(fresh.generation, old.generation);
  await old.retire(new Error("Late old deadline"));
  assert.equal(fresh.signal.aborted, false);
  assert.equal((await fresh.connection.info()).pid, fresh.info.pid);
  assert.equal(await fixture.observe(`test ! -e ${quoteShell(path)} && printf absent\n`), "absent");
  await fresh.release();
  await observeProcesses(fixture, [fresh.info.pid], { gone: true });
  console.log(JSON.stringify({ status: "PASS", limits, oldGeneration: old.generation, newGeneration: fresh.generation,
    sharedRetirement: true, lateRetirementIsolated: true, sideEffects: 0, replayed: false, identity }));
} finally {
  if (identity) await fixture.observe(`kill -CONT ${identity.runtimePid} 2>/dev/null || true\n`);
  await first.release();
  await fixture.close();
}
