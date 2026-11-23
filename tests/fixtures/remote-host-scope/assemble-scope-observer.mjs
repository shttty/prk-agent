import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export async function assembleScopeObserver(context) {
  const { host, fixture, generations, optionalRead, scopePath, ownedScopes, ownedChildren, proc, stopped,
    until, run, systemctl, root, provider, fauxAssistantMessage, fauxToolCall, text, packages, memoryMax,
    MiB, startGateway, connectGateway } = context;
    let endpoint;
    let client;
    fixture.onCleanup(async () => {
      // Capture even a generation whose assertion failed before its scope inspection.
      for (const { host: generation } of generations) {
        const cgroup = generation.registration && await optionalRead(`/proc/${generation.registration.pid}/cgroup`);
        if (cgroup) {
          const scope = scopePath(cgroup);
          if (/^prk-remote-host-[a-f0-9-]+\.scope$/u.test(basename(scope))) ownedScopes.add(scope);
        }
      }
      const failures = [];
      try { client?.disconnect(); await (endpoint ? endpoint.close() : host.close()); }
      catch (error) { failures.push(error); }
      // Failure cleanup is ownership-bound, and happens only after the tested shutdown observations.
      for (const scope of ownedScopes) {
        if (await optionalRead(join("/sys/fs/cgroup", scope, "cgroup.procs")) !== undefined) {
          try { await run(systemctl, ["--user", "stop", basename(scope)], { timeout: 10000, maxBuffer: 64 * 1024 }); }
          catch (error) {
            if (await optionalRead(join("/sys/fs/cgroup", scope, "cgroup.procs")) !== undefined) failures.push(error);
          }
        }
      }
      for (const child of ownedChildren) {
        const current = await proc(child.pid);
        if (!stopped(child, current)) {
          try {
            process.kill(child.pid, "SIGKILL");
            await until(() => proc(child.pid), (value) => stopped(child, value), "owned child failure cleanup");
          } catch (error) { if (error.code !== "ESRCH") failures.push(error); }
        }
      }
      if (failures.length) throw new AggregateError(failures, "Owned host/kernel scope cleanup failed");
    });
    endpoint = await startGateway(host, join(root, "gateway.sock"));
    client = await connectGateway(join(root, "gateway.sock"));
    const initialMemorySamples = new Map();
    client.onCollectionEvent((event) => {
      const remoteHost = event.type === "session_monitor" ? event.details?.monitor?.remoteHost : undefined;
      if (remoteHost?.memory && !initialMemorySamples.has(remoteHost.generation)) {
        initialMemorySamples.set(remoteHost.generation, { sessionId: event.sessionId, memory: remoteHost.memory });
      }
    });
    await client.request("subscribeSessions");
    const invoke = async (worker, name, args, allowHostFailure = false) => {
      const id = randomUUID();
      let result;
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }),
        (context) => {
          result = context.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id);
          return fauxAssistantMessage("Observed the owned scope operation.");
        },
      ]);
      const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "Exercise the owned host scope", mode: "plain" });
      assert.equal(admission.accepted, true, JSON.stringify(admission));
      const completion = await admission.completion;
      result ??= host.state(worker).messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id);
      if (allowHostFailure) {
        assert(["completed", "failed", "unknown"].includes(completion.status), JSON.stringify(completion));
        if (result) assert.equal(result.isError, true, text(result));
        else assert.notEqual(completion.status, "completed", "A completed operation must record its actual tool result");
      } else {
        assert.equal(completion.status, "completed", JSON.stringify(completion));
        assert(result, "The actual SDK history must contain this tool result");
        assert.equal(result.isError, false, text(result));
      }
      return { result, completion };
    };
    const plugin = async (worker, side, args = { action: "identity" }) => (await invoke(worker, `host_scope_${side}`, args)).result.details;
    const native = async (worker, action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const createNative = async () => {
      const worker = (await client.request("createSession", { target: "scope-fixture" })).session.sessionId;
      await native(worker, "local-tools", { enabled: true });
      await native(worker, "reload");
      return worker;
    };
    const remoteHostOf = async (worker) => {
      const row = (await client.request("workbench")).sessions.find((entry) => entry.sessionId === worker);
      assert(row, "The observed worker must appear in the public workbench snapshot");
      assert(row.monitor && Object.hasOwn(row.monitor, "remoteHost"), "Workbench must expose monitor.remoteHost even with monitor.enabled=false");
      return row.monitor.remoteHost;
    };
    const sampledHost = async (worker, expected, accept = () => true) => {
      const remoteHost = await until(() => remoteHostOf(worker),
        (value) => value?.generation === expected.generation.generation && value.memory && accept(value),
        `public workbench host memory for ${worker}, generation ${expected.generation.generation}`);
      assert.equal(remoteHost.state, "running");
      assert.equal(remoteHost.pid, expected.pid);
      assert.equal(remoteHost.generation, expected.generation.generation);
      assert.equal(remoteHost.error, undefined);
      const memory = remoteHost.memory;
      assert.deepEqual(Object.keys(memory).sort(), ["current", "workingSet", "baseline", "extra", "scope", "memoryMax", "memorySwapMax", "oomKill"].sort());
      for (const field of ["current", "workingSet", "baseline", "extra", "oomKill"]) assert(Number.isSafeInteger(memory[field]), `KernelMemory.${field} must be a real integer sample`);
      assert(memory.current >= memory.workingSet && memory.workingSet >= 0);
      assert(memory.baseline >= 0 && memory.oomKill >= 0);
      assert.equal(memory.extra, memory.current - memory.baseline);
      assert.equal(memory.scope, join("/sys/fs/cgroup", expected.scope));
      assert.equal(memory.memoryMax, "268435456");
      assert.equal(memory.memorySwapMax, "0");
      if (remoteHost.sampledAt !== undefined) assert(Number.isFinite(remoteHost.sampledAt) && remoteHost.sampledAt > 0);
      if (remoteHost.ageMs !== undefined) assert(Number.isFinite(remoteHost.ageMs) && remoteHost.ageMs >= 0);
      const initial = await until(() => initialMemorySamples.get(remoteHost.generation), Boolean, "initial public session_monitor memory event");
      assert.equal(initial.sessionId, worker);
      assert.equal(initial.memory.scope, memory.scope);
      assert.equal(initial.memory.baseline, initial.memory.current, "Each generation establishes its baseline from its own first real sample");
      assert.equal(initial.memory.extra, 0);
      assert.equal(memory.baseline, initial.memory.baseline, "Later samples must retain this generation's baseline");
      return remoteHost;
    };
    const generationFor = (worker) => generations.findLast((entry) => entry.sessionId === worker && entry.package === packages[0].source)?.host;
    const inspectGeneration = async (worker) => {
      const generation = generationFor(worker);
      assert(generation?.registration, "The worker must have a real target host registration");
      const observers = generations.filter((entry) => entry.sessionId === worker && entry.host === generation);
      const names = [...packages.map((pkg) => pkg.source), "Pi native tools"].sort();
      assert.deepEqual(observers.map((entry) => entry.package).sort(), names, "Each package is observed once with the SAME host generation object");
      assert.deepEqual(generation.registration.packages.map((pkg) => pkg.name).sort(), names);
      assert.equal(generation.registration.packages.find((pkg) => pkg.name === "Pi native tools").tools.length, 7);
      for (let index = 0; index < packages.length; index++) {
        assert.deepEqual(generation.registration.packages.find((pkg) => pkg.name === packages[index].source).tools.map((tool) => tool.name), [`host_scope_${index === 0 ? "a" : "b"}`]);
      }
      assert(generation.registration.packages.every((pkg) => !pkg.error), "Each observed package registered without errors");
      const a = await plugin(worker, "a");
      const b = await plugin(worker, "b");
      assert.equal(a.pid, generation.registration.pid);
      assert.equal(b.pid, a.pid);
      assert.notEqual(a.pid, process.pid);
      const cgroup = await readFile(`/proc/${a.pid}/cgroup`, "utf8");
      assert.equal(a.cgroup, cgroup);
      assert.equal(b.cgroup, cgroup);
      const scope = scopePath(cgroup);
      assert.match(basename(scope), /^prk-remote-host-[a-f0-9-]+\.scope$/u, "The target Node process must own its host scope");
      ownedScopes.add(scope);
      const properties = Object.fromEntries((await run(systemctl, ["--user", "show", basename(scope), "--property=MemoryMax", "--property=MemorySwapMax", "--property=ControlGroup", "--property=OOMPolicy"], {
        timeout: 5000, maxBuffer: 64 * 1024,
      })).stdout.trim().split("\n").map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
      assert.equal(properties.MemoryMax, String(memoryMax));
      assert.equal(properties.MemorySwapMax, "0");
      assert.equal(properties.ControlGroup, scope);
      assert.equal(properties.OOMPolicy, "continue", "An allocator OOM must not make systemd stop the surviving Node host");
      assert.equal((await readFile(join("/sys/fs/cgroup", scope, "memory.max"), "utf8")).trim(), String(memoryMax));
      assert.equal((await readFile(join("/sys/fs/cgroup", scope, "memory.swap.max"), "utf8")).trim(), "0");
      const pids = (await readFile(join("/sys/fs/cgroup", scope, "cgroup.procs"), "utf8")).trim().split(/\s+/u).map(Number);
      const hostPids = [];
      for (const pid of pids) if ((await optionalRead(`/proc/${pid}/cmdline`))?.split("\0").some((argument) => argument.endsWith("/host.mjs"))) hostPids.push(pid);
      assert.deepEqual(hostPids, [a.pid], "The packages and seven native tools share exactly one real Node host");
      const observed = { generation, pid: a.pid, scope, properties, hostPids };
      return { ...observed, remoteHost: await sampledHost(worker, observed) };
    };
    const kernel = async (worker, value, expectedPid) => {
      const code = `import json, os\nfrom pathlib import Path\n${expectedPid === undefined ? `host_scope_retained = ${JSON.stringify(value)}` : `assert os.getpid() == ${expectedPid}\nassert host_scope_retained == ${JSON.stringify(value)}`}\nprint("HOST_SCOPE_KERNEL_JSON:" + json.dumps({"pid": os.getpid(), "cgroup": Path("/proc/self/cgroup").read_text(), "value": host_scope_retained}))`;
      const output = text((await invoke(worker, "kernel_code", { code, title: "Owned scoped kernel continuity" })).result);
      const match = /^HOST_SCOPE_KERNEL_JSON:(.+)$/mu.exec(output);
      assert(match, output);
      const observed = JSON.parse(match[1]);
      observed.scope = scopePath(observed.cgroup);
      assert(observed.scope.endsWith(".scope"), "The kernel fixture MUST run in its own native systemd scope");
      assert.equal((await readFile(join("/sys/fs/cgroup", observed.scope, "memory.max"), "utf8")).trim(), String(512 * MiB));
      ownedScopes.add(observed.scope);
      return observed;
    };
    return { client, invoke, plugin, native, createNative, remoteHostOf, sampledHost, inspectGeneration, kernel };
}
