import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { runtimeLink } from "../../../src/target-channel/runtime-link/assemble-runtime-link.ts";
import { createScenario } from "./create-scenario.mjs";
import { createOwnedRuntime } from "./create-owned-runtime.mjs";
import { observeProcesses } from "./observe-processes.mjs";

export async function checkStartup(mode) {
  const scenario = await createScenario(mode);
  const { fixture, python, id } = scenario;
  let guard;
  let stopped = false;
  let link;
  try {
    guard = await fixture.acquire(id);
    const owned = await createOwnedRuntime(fixture, python, "late", {
      beforeExec: "with open(prefix+'.ledger','a') as output:\n    output.write(json.dumps(record)+'\\n')",
    });
    await fixture.observe(`kill -STOP ${guard.info.pid}\n`);
    stopped = true;
    const controllers = [];
    const pending = [];
    for (let index = 0; index < 32; index++) {
      const lease = await fixture.acquire(id);
      const controller = new AbortController();
      if (index < 31) controllers.push(controller);
      pending.push(openProcessTransport(lease, owned.executable, fixture.root, controller.signal, index === 31 ? 50 : 10000).then(
        (value) => ({ value }), (error) => ({ error }),
      ));
    }
    for (const controller of controllers) controller.abort();
    const results = await Promise.all(pending);
    assert.ok(results.slice(0, 31).every((result) => result.error?.name === "AbortError"));
    assert.match(results[31].error?.message ?? "", /startup timed out/iu);
    await assert.rejects(openProcessTransport(await fixture.acquire(id), owned.executable, fixture.root, new AbortController().signal), (error) => error.code === "BUSY");
    assert.equal(guard.signal.aborted, false, "Cancelled opens cannot close the sentinel's shared environment");
    await fixture.observe(`kill -CONT ${guard.info.pid}\n`);
    stopped = false;
    let transport;
    for (let attempt = 0; attempt < 100 && !transport; attempt++) {
      try {
        transport = await openProcessTransport(await fixture.acquire(id), owned.executable, fixture.root, new AbortController().signal);
      } catch (error) {
        if (error.code !== "BUSY") throw error;
        await delay(20);
      }
    }
    assert.ok(transport, "Native late handles must eventually return startup admission");
    link = runtimeLink(transport, 10000, () => {}, () => {});
    await link.start("", new AbortController().signal);
    await link.request("monitor", "config", { intervalMs: 500 });
    await link.close();
    link = undefined;
    assert.equal(guard.signal.aborted, false);
    assert.equal((await guard.connection.info()).pid, guard.info.pid);
    const scan = `import glob,json,os
root=${JSON.stringify(fixture.root)}
owned=[]
for entry in glob.glob('/proc/[0-9]*'):
    try:
        if os.readlink(entry+'/cwd') == root and int(entry.rsplit('/',1)[1]) != ${guard.info.pid}:
            owned.append({'pid':int(entry.rsplit('/',1)[1]),'command':open(entry+'/cmdline','rb').read().decode(errors='replace')})
    except (FileNotFoundError,ProcessLookupError,PermissionError):
        pass
print(json.dumps(owned))
`;
    let remaining;
    for (let attempt = 0; attempt < 100; attempt++) {
      remaining = JSON.parse(await fixture.observe(`${quoteShell(python)} -c ${quoteShell(scan)}\n`));
      if (!remaining.length) break;
      await delay(50);
    }
    assert.deepEqual(remaining, [], "All late owned starts must be cleaned after daemon resume");
    const ledgerText = await fixture.observe(`if test -f ${quoteShell(`${owned.prefix}.ledger`)}; then cat ${quoteShell(`${owned.prefix}.ledger`)}; fi\n`);
    const observedStarts = ledgerText.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    assert.ok(observedStarts.every((record) => record.signature === owned.signature && record.pid === record.pgid));
    await guard.release();
    await observeProcesses(fixture, [guard.info.pid], { gone: true });
    return { scenario: "startup", generation: guard.generation, daemon: guard.info.pid, abandonedStarts: 32, cancellationCount: 31, timeoutCount: 1, busyUntilNativeSettlement: true, signature: owned.signature, observedStarts, remainingOwnedProcesses: remaining };
  } finally {
    if (stopped && guard) await fixture.observe(`kill -CONT ${guard.info.pid} 2>/dev/null || true\n`);
    await link?.close();
    await scenario.close();
  }
}
