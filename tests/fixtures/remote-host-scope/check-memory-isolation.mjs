import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function checkMemoryIsolation(context) {
  const { a, b, replacement, sampledHost, plugin, heldBufferBytes, MiB, proof, eventsAt, fixture,
    allocationBytes, invoke, q, python, ownedChildren, scopePath, optionalRead, until, proc, stopped,
    remoteEvents, kernelA, inspectGeneration, kernel, valueA, valueB, kernelB, host, originalA,
    originalB, other, memoryMax, native } = context;
    const beforeHeldMemory = await sampledHost(a, replacement);
    const compareScopeMemory = async (phase, after) => {
      const snapshot = await sampledHost(a, replacement, (value) => value.sampledAt > after);
      const [currentText, stat] = await Promise.all([
        readFile(join(snapshot.memory.scope, "memory.current"), "utf8"),
        readFile(join(snapshot.memory.scope, "memory.stat"), "utf8"),
      ]);
      const current = Number(currentText.trim());
      const inactiveFile = Number(stat.match(/^inactive_file\s+(\d+)$/mu)?.[1]);
      assert(Number.isSafeInteger(current) && Number.isSafeInteger(inactiveFile), "The owned scope must expose real memory counters");
      const workingSet = Math.max(0, current - inactiveFile);
      const errorBytes = Math.abs(snapshot.memory.workingSet - workingSet);
      assert(errorBytes <= 4 * MiB,
        `${phase}: public workingSet ${snapshot.memory.workingSet} must match contemporaneous cgroup workingSet ${workingSet} within 4 MiB`);
      return { snapshot, cgroup: { current, inactiveFile, workingSet, errorBytes } };
    };
    let duringHeldMemory;
    let heldMemoryCheck;
    try {
      const held = await plugin(a, "a", { action: "hold-memory" });
      assert.equal(held.pid, replacement.pid);
      assert.equal(held.heldBufferBytes, heldBufferBytes);
      heldMemoryCheck = await compareScopeMemory("held", Date.now());
      duringHeldMemory = heldMemoryCheck.snapshot;
      assert.equal(duringHeldMemory.memory.baseline, beforeHeldMemory.memory.baseline);
    } finally {
      const released = await plugin(a, "a", { action: "release-memory" });
      assert.equal(released.heldBufferBytes, 0, "Release the fixture's backing store before the bounded native OOM allocation");
    }
    const releasedMemoryCheck = await compareScopeMemory("released", Date.now());
    const afterHeldMemory = releasedMemoryCheck.snapshot;
    assert(duringHeldMemory.memory.workingSet - beforeHeldMemory.memory.workingSet >= heldBufferBytes / 2,
      "Holding a touched 64 MiB Buffer must grow the public working set by at least half its allocation");
    assert(duringHeldMemory.memory.workingSet - afterHeldMemory.memory.workingSet >= heldBufferBytes / 2,
      "Releasing the Buffer must reduce the public working set by at least half its allocation");
    proof("workbench-real-host-memory-growth", { sessionId: a, pid: replacement.pid, generation: replacement.generation.generation,
      scope: replacement.scope, allocatedBytes: heldBufferBytes, before: beforeHeldMemory, held: duringHeldMemory, released: afterHeldMemory,
      directHeld: heldMemoryCheck.cgroup, directReleased: releasedMemoryCheck.cgroup,
      workingSetIncreaseBytes: duringHeldMemory.memory.workingSet - beforeHeldMemory.memory.workingSet });

    const beforeOom = await eventsAt(replacement.scope);
    assert(beforeOom && Number.isInteger(beforeOom.oom_kill), "The actual host scope must expose readable OOM counters before allocation");
    const beforeOomSnapshot = await sampledHost(a, replacement, (value) => value.memory.oomKill === beforeOom.oom_kill);
    const oomStart = join(fixture.tempRoot, "oom-start.json");
    const oomExit = join(fixture.tempRoot, "oom-exit.json");
    const oomCompleted = join(fixture.tempRoot, "oom-unexpectedly-completed");
    const allocation = `import json, os\nfrom pathlib import Path\nPath("/proc/self/oom_score_adj").write_text("1000")\nfields = Path("/proc/self/stat").read_text().rsplit(") ", 1)[1].split()\nPath(${JSON.stringify(oomStart)}).write_text(json.dumps({"pid":os.getpid(),"startTime":fields[19],"cgroup":Path("/proc/self/cgroup").read_text()}))\nblocks = []\nfor _ in range(${allocationBytes / (8 * MiB)}):\n    block = bytearray(${8 * MiB})\n    for offset in range(0, len(block), 4096):\n        block[offset] = 1\n    blocks.append(block)\nPath(${JSON.stringify(oomCompleted)}).write_text("allocation escaped the configured memory cap")`;
    // Never allocate until both systemctl AND cgroup files above verified a finite 256 MiB cap and no swap.
    // The child has the highest OOM preference; even a broken cap can allocate only 288 MiB, never unbounded RAM.
    let sampledMemoryEvents = beforeOom;
    let allocationSettled = false;
    const operation = invoke(a, "bash", { command: `${q(python)} -c ${q(allocation)}; status=$?; printf '{"status":%s}\\n' "$status" > ${q(oomExit)}; exit "$status"` }, true)
      .finally(() => { allocationSettled = true; });
    const sampling = (async () => {
      // Keep real counters if the manager removes the complete scope on OOM.
      while (!allocationSettled) {
        const counters = await eventsAt(replacement.scope);
        if (counters) sampledMemoryEvents = counters;
        await delay(5);
      }
    })();
    const [oom] = await Promise.all([operation, sampling]);
    const started = JSON.parse(await readFile(oomStart, "utf8"));
    ownedChildren.push(started);
    assert.equal(scopePath(started.cgroup), replacement.scope);
    assert.equal(await optionalRead(oomCompleted), undefined, "The bounded above-cap allocation must not complete");
    const allocationAfter = await until(() => proc(started.pid), (current) => stopped(started, current), "OOM allocation child exit");
    const observedOom = await until(async () => {
      const exit = JSON.parse(await optionalRead(oomExit) ?? "null");
      const afterOom = await eventsAt(replacement.scope);
      const killedByScopeOom = (afterOom ?? sampledMemoryEvents).oom_kill > beforeOom.oom_kill;
      const hostExit = remoteEvents.find((event) => event.generation === replacement.generation.generation && event.t === "exit" && [-9, 137].includes(event.code));
      return { exit, afterOom, killedByScopeOom, hostExit };
    }, ({ exit, killedByScopeOom, hostExit }) => killedByScopeOom || exit?.status === 137 || !!hostExit,
    "actual scope OOM counter or SIGKILL (a tool error or MemoryError is insufficient)");
    const { exit, afterOom, killedByScopeOom, hostExit } = observedOom;
    const kernelImmediatelyAfter = await proc(kernelA.pid);
    assert(kernelImmediatelyAfter && !["Z", "X"].includes(kernelImmediatelyAfter.state), "The original kernel process must still be alive immediately after native host OOM");
    const survivingHost = await proc(replacement.pid);
    assert(survivingHost && !["Z", "X"].includes(survivingHost.state), "The preferred native allocator victim must leave its Node host alive under OOMPolicy=continue");
    const afterOomSnapshot = await sampledHost(a, replacement,
      (value) => value.memory.oomKill === beforeOomSnapshot.memory.oomKill + 1);
    assert.equal(afterOomSnapshot.memory.oomKill, beforeOomSnapshot.memory.oomKill + 1, "The workbench API must expose exactly one actual cgroup OOM kill");
    assert.equal(afterOomSnapshot.state, "running");
    assert.equal(afterOomSnapshot.generation, beforeOomSnapshot.generation);
    assert.equal(afterOomSnapshot.pid, beforeOomSnapshot.pid);
    assert.equal(afterOomSnapshot.memory.baseline, beforeOomSnapshot.memory.baseline);
    // Explicit reload must start fresh host accounting, without replacing either kernel.
    await native(a, "reload");
    const afterOomReload = await inspectGeneration(a);
    assert.notEqual(afterOomReload.generation.generation, afterOomSnapshot.generation);
    assert.notEqual(afterOomReload.scope, replacement.scope);
    assert.equal(afterOomReload.remoteHost.memory.oomKill, 0, "A fresh host scope must not accumulate the previous generation's OOM counter");
    const kernelAfter = await kernel(a, valueA, kernelA.pid);
    const otherKernelAfter = await kernel(b, valueB, kernelB.pid);
    assert.equal(host.state(a).sessionId, originalA.sessionId);
    assert.equal(host.state(a).kernel.kernelId, originalA.kernel.kernelId);
    assert.equal(kernelAfter.scope, kernelA.scope);
    assert.equal((await plugin(b, "b")).pid, other.pid);
    assert.equal(host.state(b).sessionId, originalB.sessionId);
    assert.equal(host.state(b).streamId, originalB.streamId);
    assert.equal(host.state(b).kernel.kernelId, originalB.kernel.kernelId);
    proof("native-host-oom-isolates-kernels-and-other-worker", { sessionId: a, hostPid: replacement.pid, hostScope: replacement.scope,
      memoryMax, memorySwapMax: 0, allocationCeilingBytes: allocationBytes, allocationPid: started.pid,
      allocationState: allocationAfter?.state ?? "absent", shellExitStatus: exit?.status ?? null, memoryEventsBefore: beforeOom,
      memoryEventsAfter: afterOom ?? null, sampledMemoryEvents, scopeOomKillObserved: killedByScopeOom, hostExitCode: hostExit?.code ?? null,
      workbenchBeforeOom: beforeOomSnapshot, workbenchAfterOom: afterOomSnapshot, workbenchAfterReload: afterOomReload.remoteHost,
      hostReloadedAfterOom: true, operationStatus: oom.completion.status,
      kernelPidBefore: kernelA.pid, kernelPidAfter: kernelAfter.pid, kernelScope: kernelAfter.scope, retainedVariable: kernelAfter.value,
      otherWorker: b, otherHostPid: other.pid, otherKernelPidBefore: kernelB.pid, otherKernelPidAfter: otherKernelAfter.pid, otherRetainedVariable: otherKernelAfter.value });
    console.log("PASS remote host scope: shared package/native host and event payloads, hostless null API, configured separate cgroups, real workbench memory growth/OOM/reset, detached child shutdown, and other session continuity");
}
