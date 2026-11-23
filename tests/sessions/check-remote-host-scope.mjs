import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
// Real Gateway/Pi/faux + owned scoped Jupyter + target channel/Node host. No paid models.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { findFixtureExecutable, prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { assembleScopeObserver } from "../fixtures/remote-host-scope/assemble-scope-observer.mjs";
import { checkHostScope } from "../fixtures/remote-host-scope/check-host-scope.mjs";
import { checkMemoryIsolation } from "../fixtures/remote-host-scope/check-memory-isolation.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Unset JUPYTER_URL/JUPYTER_TOKEN; only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "Unavailable prerequisite: PI_TEST_PYTHON must name an existing ipykernel/Jupyter Python runtime");
assert.equal(process.env.SHELL, "/bin/bash", "Run this acceptance test with SHELL=/bin/bash");
assert.equal(process.platform, "linux", "Unavailable prerequisite: Linux /proc and delegated cgroup-v2 memory are required");
const run = promisify(execFile);
const MiB = 1024 ** 2;
const memoryMax = 256 * MiB;
const heldBufferBytes = 64 * MiB;
const allocationBytes = memoryMax + 32 * MiB;
const root = await mkdtemp(join(tmpdir(), "prk-remote-host-scope-"));
const home = join(root, "prk");
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const { agentDir, configPath } = initializePrkHome(home);
const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const proof = (name, fields) => console.log(JSON.stringify({ proof: name, ...fields }));
const optionalRead = async (path) => {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (["ENOENT", "ESRCH", "ENODEV"].includes(error.code)) return undefined; throw error; }
};
const scopePath = (cgroup) => {
  const scope = cgroup.split("\n").find((line) => line.startsWith("0::"))?.slice(3);
  assert(scope?.startsWith("/"), "The actual process must expose a unified cgroup-v2 path");
  return scope;
};
const proc = async (pid) => {
  const value = await optionalRead(`/proc/${pid}/stat`);
  if (!value) return undefined;
  const fields = value.slice(value.lastIndexOf(")") + 2).split(" ");
  return { pid, state: fields[0], ppid: Number(fields[1]), pgrp: Number(fields[2]), sid: Number(fields[3]), startTime: fields[19] };
};
const until = async (read, accept, label, timeout = 10000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await read();
    if (accept(value)) return value;
    await delay(25);
  }
  throw new Error(`Timed out observing ${label}`);
};
const stopped = (identity, current) => !current || current.startTime !== identity.startTime || ["Z", "X"].includes(current.state);
const eventsAt = async (scope) => {
  const value = await optionalRead(join("/sys/fs/cgroup", scope, "memory.events"));
  return value === undefined ? undefined : Object.fromEntries(value.trim().split("\n").map((line) => {
    const [name, count] = line.split(/\s+/u);
    return [name, Number(count)];
  }));
};
const ownedScopes = new Set();
const ownedChildren = [];
let prerequisitesReady = false;

try {
  const systemctl = await findFixtureExecutable("systemctl");
  await findFixtureExecutable("systemd-run");
  const python = await findFixtureExecutable("python3", process.env.PI_TEST_PYTHON);
  const sleep = await findFixtureExecutable("sleep");
  assert((await readFile("/sys/fs/cgroup/cgroup.controllers", "utf8")).split(/\s+/u).includes("memory"), "Unavailable prerequisite: cgroup-v2 memory controller");
  await run(systemctl, ["--user", "show", "--property=Version", "--value"], { timeout: 5000, maxBuffer: 64 * 1024 });
  const artifacts = await prepareNativeToolArtifacts(home);
  prerequisitesReady = true;
  proof("scoped-host-prerequisites", { python, userManager: true, cgroupV2Memory: true,
    rg: { version: artifacts.rg.version, sha256: artifacts.rg.sha256 }, fd: { version: artifacts.fd.version, sha256: artifacts.fd.sha256 },
    hostMemoryMax: memoryMax, hostMemorySwapMax: 0, allocationCeilingBytes: allocationBytes });
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");
  const packages = [];
  for (const side of ["a", "b"]) {
    const source = join(root, `plugin-${side}`);
    await mkdir(source);
    await writeFile(join(source, "package.json"), JSON.stringify({ name: `@prk-tests/host-scope-${side}`, version: "1.0.0", private: true,
      type: "module", files: ["index.js"], pi: { extensions: ["./index.js"] } }));
    await writeFile(join(source, "index.js"), `import { Type } from "typebox";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
export default function(pi) {
  const received = [];
  let heldBuffer;
  pi.events.on("prk-host-scope:${side === "a" ? "b" : "a"}", (payload) => received.push(payload));
  pi.registerTool({ name: "host_scope_${side}", label: "Owned scope ${side}", description: "Inspect the owned host, exchange payloads, hold/release touched memory, or start its detached child.",
    parameters: Type.Object({ action: Type.Union([Type.Literal("identity"), Type.Literal("emit"), Type.Literal("detach"), Type.Literal("hold-memory"), Type.Literal("release-memory")]),
      payload: Type.Optional(Type.Unknown()), pidFile: Type.Optional(Type.String()) }),
    async execute(_id, args) {
      if (args.action === "emit") pi.events.emit("prk-host-scope:${side}", args.payload);
      if (args.action === "hold-memory") {
        heldBuffer = Buffer.alloc(${heldBufferBytes});
        for (let offset = 0; offset < heldBuffer.length; offset += 4096) heldBuffer[offset] = 0x5a;
      }
      if (args.action === "release-memory" && heldBuffer) {
        heldBuffer.buffer.transfer(0);
        heldBuffer = undefined;
      }
      let childPid;
      if (args.action === "detach") {
        const child = spawn(${JSON.stringify(sleep)}, ["120"], { detached: true, stdio: "ignore" });
        await once(child, "spawn");
        childPid = child.pid;
        child.unref();
        await writeFile(args.pidFile, JSON.stringify({ pid: childPid }));
      }
      return { content: [{ type: "text", text: "Owned host scope observation" }],
        details: { pid: process.pid, cgroup: await readFile("/proc/self/cgroup", "utf8"), received: [...received], childPid, heldBufferBytes: heldBuffer?.length ?? 0 } };
    } });
}
`);
    packages.push({ source, enabled: true, location: "host" });
  }

  const kernelOptions = { memoryMax: "512M", memorySwapMax: "0", telemetryIntervalMs: 1000 };
  await withTargetFixture(async (fixture) => {
    assert.equal(fixture.owned, true);
    const document = { remoteHost: { runtime: process.env.PI_TEST_REMOTE_HOST_RUNTIME ?? "bun", memoryMax, memorySwapMax: 0, abortTimeoutMs: 5000 }, kernel: kernelOptions,
      monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false },
      session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true, workerTools: "code", idleTimeoutMs: 600000 } };
    await writeFile(configPath, stringify(document));
    const configuration = parsePrkConfig(document);
    let channelOpens = 0;
    const channels = createTargetChannels({ options: { ...configuration.targetConnection, processWindow: configuration.processWindow }, async open(machine, signal, limits) {
      assert(["scope-fixture", "bare-scope-fixture", "local-scope-fixture"].includes(machine), `Unexpected target: ${machine}`);
      channelOpens++;
      return { command: "",
        transport: await openProcessTransport(await fixture.runtime.acquire(), fixture.config.python, fixture.config.cwd, signal, configuration.targetConnection.startTimeoutMs, limits) };
    } });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "host-scope-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const generations = [];
    const remoteEvents = [];
    const host = await createGatewayHost({ cwd: root, home, noSkills: true, historyDir: join(home, "history"),
      model: "host-scope-controlled/controlled", thinkingLevel: "off", config: configuration,
      targets: [executionTargetFromConfig({ ...fixture.config, id: "scope-fixture", label: "Owned scoped target", local: false, sshCommand: "exec /bin/sh", tags: [] }),
      executionTargetFromConfig({ ...fixture.config, id: "bare-scope-fixture", label: "Owned remote without a host", local: false, sshCommand: "exec /bin/sh", tags: [] }),
      executionTargetFromConfig({ ...fixture.config, id: "local-scope-fixture", label: "Owned local without a host", local: true, tags: [] })] }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir, targetChannels: channels },
      onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); },
      onRemoteExtensionEvent(event) { remoteEvents.push(event); },
    });
    const context = { host, fixture, generations, remoteEvents, optionalRead, scopePath, ownedScopes,
      ownedChildren, proc, stopped, until, run, systemctl, root, provider, fauxAssistantMessage,
      fauxToolCall, text, packages, memoryMax, heldBufferBytes, allocationBytes, MiB, startGateway,
      connectGateway, proof, document, python, q, eventsAt };
    const observer = await assembleScopeObserver(context);
    const lifetime = await checkHostScope({ ...context, ...observer, get channelOpens() { return channelOpens; } });
    await checkMemoryIsolation({ ...context, ...observer, ...lifetime });


  }, { tempParent: root, allowHidden: true, kernelOptions });
} catch (error) {
  if (!prerequisitesReady) proof("unavailable-prerequisite", { message: error.message });
  throw error;
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
