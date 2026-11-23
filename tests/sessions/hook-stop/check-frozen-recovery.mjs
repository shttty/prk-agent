import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function checkFrozenRecovery({ sessionId: worker, host, invoke, active, client, exists, waitEvent, remoteEvents, counter, start, cancel, until, normal, proof, document, text, monitorEvents, pkg, create, events }) {
    const seed = await invoke(worker, "kernel_code", { code: 'import json, os\nhook_stop_retained = 63117\nprint(json.dumps({"hook_stop_retained": hook_stop_retained, "kernel_pid": os.getpid()}))', title: "Seed retained kernel variable" });
    const before = host.state(worker);
    const oldGeneration = active(worker);
    const monitorBefore = (await client.request("workbench")).sessions.find((entry) => entry.sessionId === worker).monitor.remoteHost;
    assert.equal(monitorBefore.state, "running");
    assert.equal(monitorBefore.generation, oldGeneration.generation);
    const oldPid = oldGeneration.registration.pid;
    const oldCgroup = (await readFile(`/proc/${oldPid}/cgroup`, "utf8")).trim().split("\n").find((line) => line.startsWith("0::"))?.slice(3);
    assert(oldCgroup?.endsWith(".scope"), "The frozen host must belong to its own systemd scope");
    const oldScopePath = `/sys/fs/cgroup${oldCgroup}`;
    assert(await exists(oldScopePath));
    const startEvent = await waitEvent(remoteEvents, (entry) => entry.event === "session_start" && entry.pid === oldPid && entry.sessionId === before.sessionId, "Original generation session_start");
    assert(startEvent.sessionFile, "Gateway sessions must use the SDK's real JSONL history");
    assert((await readFile(startEvent.sessionFile, "utf8")).includes(seed.id));
    const sentinel = await create();
    await invoke(sentinel, "kernel_code", { code: "hook_stop_other = 82719", title: "Seed independent worker" });
    const sentinelBefore = host.state(sentinel);
    const sentinelGeneration = active(sentinel);
    assert.notEqual(sentinelGeneration.registration.pid, oldPid);
    const frozenToken = randomUUID();
    const frozen = await start(worker, "hook_probe", { mode: "remote-frozen", token: frozenToken });
    await waitEvent(remoteEvents, (entry) => entry.event === "call-enter" && entry.token === frozenToken, "Synchronous infinite-loop hook entered");
    await waitEvent(counter, (entry) => entry.token === frozenToken, "Irreversible pre-freeze side effect");
    const recoveryStarted = performance.now();
    const stopped = await cancel(worker, frozen, 10000);
    const replacement = await until(() => active(worker), (generation) => generation && generation !== oldGeneration && generation.registration,
      "Frozen host replacement generation");
    await until(() => host.session(worker).isIdle, Boolean, "Replacement SDK worker is idle");
    await until(() => exists(`/proc/${oldPid}`), (present) => !present, "Old target host PID is gone");
    await until(() => exists(oldScopePath), (present) => !present, "Old target host scope is gone");
    const restarted = await waitEvent(remoteEvents, (entry) => entry.event === "session_start" && entry.pid === replacement.registration.pid && entry.sessionId === before.sessionId,
      "Replacement plugin receives session_start");
    const recovered = host.state(worker);
    assert.notEqual(replacement.generation, oldGeneration.generation);
    assert.notEqual(replacement.registration.pid, oldPid);
    assert.equal(active(worker, "Pi native tools"), replacement, "Frozen-plugin recovery also replaces this session's native tools");
    await until(() => monitorEvents, (entries) => entries.some((entry) => entry.sessionId === worker && entry.generation === oldGeneration.generation && entry.state === "failed" && entry.error), "Failed old host monitor event");
    assert(monitorEvents.some((entry) => entry.sessionId === worker && entry.generation === oldGeneration.generation && entry.state === "replacing"), "Freeze recovery must publish replacing, not clear the old monitor to null");
    const monitorAfter = (await client.request("workbench")).sessions.find((entry) => entry.sessionId === worker).monitor.remoteHost;
    assert.equal(monitorAfter.state, "running");
    assert.equal(monitorAfter.generation, replacement.generation);
    assert.equal(monitorAfter.pid, replacement.registration.pid);
    assert.equal(monitorAfter.memory.oomKill, 0, "A new scope must not inherit the old scope's OOM accounting");
    assert.equal(recovered.sessionId, before.sessionId);
    assert.notEqual(recovered.streamId, before.streamId);
    assert.equal(recovered.kernel.kernelId, before.kernel.kernelId);
    assert.equal(restarted.sessionFile, startEvent.sessionFile);
    assert(host.state(worker).messages.some((message) => message.role === "toolResult" && message.toolCallId === seed.id), "SDK history survives the worker reload");
    const retained = await invoke(worker, "kernel_code", { code: 'assert hook_stop_retained == 63117\nprint(json.dumps({"hook_stop_retained": hook_stop_retained, "kernel_pid": os.getpid()}))', title: "Read retained kernel variable" });
    const retainedEvidence = JSON.parse(text(retained.result).split("\n").find((line) => line.startsWith('{"hook_stop_retained":')));
    const seedEvidence = JSON.parse(text(seed.result).split("\n").find((line) => line.startsWith('{"hook_stop_retained":')));
    assert.deepEqual(retainedEvidence, seedEvidence);
    assert.equal(retainedEvidence.hook_stop_retained, 63117);
    const history = await readFile(startEvent.sessionFile, "utf8");
    for (const id of [seed.id, frozen.id, retained.id]) assert(history.includes(id), `The same JSONL retains ${id}`);
    assert.equal((await events(counter)).filter((entry) => entry.token === frozenToken).length, 1, "An uncertain frozen hook must never be replayed");
    assert(!(await events(remoteEvents)).some((entry) => entry.event === "execute" && entry.token === frozenToken));
    assert(!(await events(remoteEvents)).some((entry) => entry.event === "abort" && entry.token === frozenToken), "The synchronous loop cannot process an abort acknowledgement");
    assert.equal(active(sentinel), sentinelGeneration, "Another session's target host is not replaced");
    assert.equal(host.state(sentinel).streamId, sentinelBefore.streamId);
    assert.equal(host.state(sentinel).kernel.kernelId, sentinelBefore.kernel.kernelId);
    await invoke(sentinel, "kernel_code", { code: "assert hook_stop_other == 82719\nprint(hook_stop_other)", title: "Read independent worker variable" });
    await normal(sentinel);
    await normal(worker);
    proof("frozen-hook-replacement", { sessionId: worker, sentinel, abortTimeoutMs: document.remoteHost.abortTimeoutMs, stopDurationMs: stopped.durationMs,
      replacementDurationMs: performance.now() - recoveryStarted, oldPid, pid: replacement.registration.pid, oldScope: oldCgroup,
      generation: replacement.generation, oldGeneration: oldGeneration.generation, sessionId: recovered.sessionId,
      oldStreamId: before.streamId, streamId: recovered.streamId, kernelId: recovered.kernel.kernelId,
      retained: retainedEvidence, sideEffectCount: 1, sentinelPid: sentinelGeneration.registration.pid, sentinelVariable: 82719 });

}
