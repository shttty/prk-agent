import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export async function checkHostScope(context) {
  const { client, generations, proof, document, createNative, inspectGeneration, kernel, packages,
    host, plugin, text, invoke, q, python, scopePath, fixture, proc, ownedChildren, stopped, until,
    native, ownedScopes, sampledHost } = context;
    const opensBeforeHostless = context.channelOpens;
    const hostless = [];
    for (const target of ["bare-scope-fixture", "local-scope-fixture"]) {
      const worker = (await client.request("createSession", { target })).session.sessionId;
      const opensBeforeObservation = context.channelOpens;
      const row = (await client.request("workbench")).sessions.find((entry) => entry.sessionId === worker);
      assert(row, "A cold worker remains present in the real workbench snapshot");
      if (row.monitor !== undefined) assert.equal(row.monitor.remoteHost, null, "An exposed cold monitor reports no remote host");
      assert.equal(generations.some((entry) => entry.sessionId === worker), false, "A hostless worker must not register a Node host");
      assert.equal(context.channelOpens, opensBeforeObservation, "Observing a hostless worker must not open a target channel");
      hostless.push({ target, sessionId: worker, remoteHost: null, monitorExposed: row.monitor !== undefined });
    }
    assert.equal(context.channelOpens, opensBeforeHostless + 1, "Remote cwd discovery opens the bare target channel; local no-skills creation and observation open none");
    proof("workbench-hostless-monitor-null", { monitorEnabled: document.monitor.enabled, sessions: hostless });
    const bare = hostless.find((entry) => entry.target === "bare-scope-fixture").sessionId;
    await native(bare, "local-tools", { enabled: true });
    assert.equal(generations.some((entry) => entry.sessionId === bare), false, "Switching native tools alone keeps the target host cold");
    const bareBash = JSON.parse(text((await invoke(bare, "bash", { command: `${q(python)} -c ${q('import json,os; from pathlib import Path; print(json.dumps({"pid":os.getpid(),"cgroup":Path("/proc/self/cgroup").read_text()}))')}` })).result).trim());
    const bareGeneration = generations.findLast((entry) => entry.sessionId === bare && entry.package === "Pi native tools")?.host;
    assert(bareGeneration?.registration, "A real native call starts the bare target host before scope observations");
    assert.notEqual(bareGeneration.registration.pid, process.pid);
    const bareScope = scopePath(await readFile(`/proc/${bareGeneration.registration.pid}/cgroup`, "utf8"));
    assert.match(basename(bareScope), /^prk-remote-host-[a-f0-9-]+\.scope$/u);
    ownedScopes.add(bareScope);
    assert.equal(scopePath(bareBash.cgroup), bareScope, "The native child runs in the actual newly started host scope");
    const bareMonitor = await sampledHost(bare, { generation: bareGeneration, pid: bareGeneration.registration.pid, scope: bareScope });
    proof("cold-native-host-starts-before-scope-observation", { sessionId: bare, nativePid: bareGeneration.registration.pid,
      nativeChildPid: bareBash.pid, scope: bareScope, monitorEnabled: document.monitor.enabled, remoteHost: bareMonitor });

    for (const { source, location } of packages) await host.pluginsInstall({ source, location });
    const a = await createNative();
    const first = await inspectGeneration(a);
    const opensBeforeB = context.channelOpens;
    const b = await createNative();
    const other = await inspectGeneration(b);
    assert.equal(context.channelOpens, opensBeforeB, "The second worker must reuse the live target channel");
    assert.notEqual(other.pid, first.pid);
    assert.notEqual(other.scope, first.scope);
    const valueA = `kernel-a-${randomUUID()}`;
    const valueB = `kernel-b-${randomUUID()}`;
    const kernelA = await kernel(a, valueA);
    const kernelB = await kernel(b, valueB);
    const originalA = host.state(a);
    const originalB = host.state(b);
    assert.notEqual(first.scope, kernelA.scope);
    assert.notEqual(other.scope, kernelB.scope);
    const forward = { token: randomUUID(), direction: "a-to-b", nested: { number: 41, unicode: "事件载荷", flags: [true, false, null] } };
    const backward = { token: randomUUID(), direction: "b-to-a", nested: { number: 99, unicode: "反向载荷", flags: [false, true, null] } };
    await plugin(a, "a", { action: "emit", payload: forward });
    assert.deepEqual((await plugin(a, "b")).received, [forward], "Package B must receive the actual A payload through native pi.events");
    await plugin(a, "b", { action: "emit", payload: backward });
    assert.deepEqual((await plugin(a, "a")).received, [backward], "Package A must receive the actual B payload through native pi.events");
    assert.deepEqual((await plugin(b, "a")).received, [], "The other session must not receive this host's events");
    assert.deepEqual((await plugin(b, "b")).received, []);
    const bashIdentity = text((await invoke(a, "bash", { command: `${q(python)} -c ${q('import json,os; from pathlib import Path; print(json.dumps({"pid":os.getpid(),"cgroup":Path("/proc/self/cgroup").read_text()}))')}` })).result);
    const bash = JSON.parse(bashIdentity.trim());
    assert.equal(scopePath(bash.cgroup), first.scope, "The real native bash allocation will run inside the host scope, not the kernel scope");
    proof("one-host-and-native-event-payloads", { sessionId: a, packages: packages.map((pkg) => pkg.source), hostPid: first.pid, hostPids: first.hostPids,
      hostScope: first.scope, kernelPid: kernelA.pid, kernelScope: kernelA.scope, systemctl: first.properties,
      nativeChildPid: bash.pid, nativeChildScope: scopePath(bash.cgroup), forward, backward, otherWorker: b, otherHostPid: other.pid, sharedTargetChannel: true });

    const pidFile = join(fixture.tempRoot, "detached-child.json");
    const detached = await plugin(a, "a", { action: "detach", pidFile });
    const childPid = JSON.parse(await readFile(pidFile, "utf8")).pid;
    assert.equal(childPid, detached.childPid);
    const child = await proc(childPid);
    assert(child && !["Z", "X"].includes(child.state), "The detached fixture process must actually be alive before shutdown");
    ownedChildren.push(child);
    assert.equal(child.sid, childPid, "spawn(detached:true) must put the child in its own setsid session");
    assert.equal(child.pgrp, childPid);
    assert.equal(scopePath(await readFile(`/proc/${childPid}/cgroup`, "utf8")), first.scope);
    await native(a, "reload");
    const childAfter = await until(() => proc(childPid), (current) => stopped(child, current), "detached child killed by native scope reload");
    const firstAfter = await until(() => proc(first.pid), (current) => !current || ["Z", "X"].includes(current.state), "retired Node host exit");
    const replacement = await inspectGeneration(a);
    assert.notEqual(replacement.pid, first.pid);
    assert.notEqual(replacement.scope, first.scope);
    assert.notEqual(replacement.generation, first.generation);
    assert.equal(host.state(a).sessionId, originalA.sessionId);
    assert.equal(host.state(a).kernel.kernelId, originalA.kernel.kernelId);
    await kernel(a, valueA, kernelA.pid);
    await kernel(b, valueB, kernelB.pid);
    assert.equal((await plugin(b, "a")).pid, other.pid);
    assert.equal(host.state(b).streamId, originalB.streamId);
    proof("scope-reload-kills-setsid-child", { sessionId: a, retiredHostPid: first.pid, retiredHostState: firstAfter?.state ?? "absent",
      detachedChildPid: childPid, childSessionId: child.sid, childState: childAfter?.state ?? "absent", oldScope: first.scope,
      replacementHostPid: replacement.pid, replacementScope: replacement.scope, kernelPid: kernelA.pid, kernelVariable: valueA,
      otherWorker: b, otherHostPid: other.pid, otherKernelPid: kernelB.pid });
    return { a, b, replacement, kernelA, kernelB, valueA, valueB, originalA, originalB, other };
}
