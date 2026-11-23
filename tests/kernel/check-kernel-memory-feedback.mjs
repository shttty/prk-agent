import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createTarget } from "./fixtures/create-target.mjs";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Unset JUPYTER_URL and JUPYTER_TOKEN; this check owns its scoped stdlib runner.");
const home = await mkdtemp(join(tmpdir(), "prk-memory-feedback-"));
const { agentDir } = initializePrkHome(home);
const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
// Quick cells cannot rely on interval telemetry to update the model's result.
const kernelOptions = { memoryMax: "4G", memorySwapMax: "0", telemetryIntervalMs: 60_000 };
const text = (message) => (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const target = await createTarget("local"), cleanups = [];

try {
  await mkdir(agentDir);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");

  await (async () => {
    const tempRoot = target.root, onCleanup = (cleanup) => cleanups.push(cleanup);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "memory-feedback-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const config = parsePrkConfig({ kernel: kernelOptions, session: { workerTools: "code" }, memory: { review: false }, monitor: { enabled: false } });
    const limits = parseProcessWindowLimits();
    const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, config.targetConnection.startTimeoutMs, limits), command: "" }) });
    const host = await createGatewayHost({
      cwd: home, home, model: "memory-feedback-check/controlled", config,
      targets: [executionTargetFromConfig({ id: "fixture", label: "fixture", local: true, python: target.python, cwd: tempRoot })],
    }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: channels,
      createKernel: (hooks) => createPythonTool({ target: "fixture", python: target.python, cwd: tempRoot, acquire: target.acquire, processWindow: limits, memoryMax: kernelOptions.memoryMax, memorySwapMax: kernelOptions.memorySwapMax, scoped: true }, hooks, { telemetryIntervalMs: kernelOptions.telemetryIntervalMs }) } });
    const socket = join(home, "gateway.sock");
    const server = await startGateway(host, socket);
    const client = await connectGateway(socket);
    onCleanup(async () => { client.disconnect(); await server.close(); });
    await prepareGatewayEnvironment(host, home, "fixture");
    const worker = (await host.createSession({ target: "fixture", cwd: tempRoot })).session.sessionId;
    let sequence = 0;
    const measurements = [];

    async function run(label, code) {
      let result;
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall("kernel_code", { code, title: "Kernel memory feedback" }), { stopReason: "toolUse" }),
        (context) => {
          result = structuredClone(context.messages.at(-1));
          return fauxAssistantMessage("Observed the real kernel memory result.");
        },
      ]);
      const operation = await host.session(worker).submit({ requestId: `memory-feedback-${++sequence}`, message: "Execute the memory feedback cell." });
      assert.equal(operation.accepted, true);
      assert.equal((await operation.completion).status, "completed");
      assert.equal(result?.role, "toolResult", `${label}: capture the actual next provider request`);
      assert.equal(result.toolName, "kernel_code");
      assert.equal(result.isError, false, text(result));
      const output = text(result);
      const snapshot = await client.request("state", { sessionId: worker });
      assert.equal(snapshot.kernel.state, "idle");
      const memory = snapshot.kernel.memory;
      assert(memory, `${label}: Gateway wire snapshot includes cgroup memory`);
      assert.equal(memory.memoryMax, "4G");
      assert(Number.isFinite(memory.workingSet) && memory.workingSet >= 0 && memory.workingSet <= memory.current, `${label}: numeric workingSet excludes reclaimable charges`);
      const lastLine = output.trimEnd().split(/\r?\n/u).at(-1);
      const measured = { label, currentMiB: memory.current / MiB, workingSetMiB: memory.workingSet / MiB, lastLine };
      measurements.push(measured);
      console.log(JSON.stringify(measured));
      const footer = /^\[kernel memory (\d+\.\d)\/(\d+\.\d) (MiB|GiB)\]$/u.exec(lastLine);
      assert(footer, `${label}: one-decimal MiB/GiB memory footer must be the final result line: ${output}`);
      assert.equal((output.match(/^\[kernel memory /gmu) ?? []).length, 1, `${label}: exactly one footer`);
      const unit = footer[3] === "GiB" ? GiB : MiB;
      assert.equal(Number(footer[2]), 4 * GiB / unit, `${label}: footer reports the configured limit`);
      assert.equal(Number(footer[1]), Number((memory.workingSet / unit).toFixed(1)), `${label}: model footer uses this cell's working set, not current or a previous sample`);
      return { memory, footerBytes: Number(footer[1]) * unit };
    }

    const baseline = await run("baseline with cold owned file", `import gc, os
from pathlib import Path
feedback_file = Path(${JSON.stringify(join(tempRoot, "memory-feedback-cache.bin"))})
with feedback_file.open('wb', buffering=0) as file:
    chunk = b'p' * (1024 ** 2)
    for _index in range(256):
        assert file.write(chunk) == len(chunk)
    os.fsync(file.fileno())
    os.posix_fadvise(file.fileno(), 0, 0, os.POSIX_FADV_DONTNEED)
del chunk
gc.collect()
assert feedback_file.stat().st_size == 256 * 1024 ** 2
print('COLD_FILE_READY')`);
    const allocated = await run("allocate 200 MiB in this cell", "feedback_allocation = bytearray(200 * 1024 ** 2)\nprint('ALLOCATION_READY')");
    const allocationJump = allocated.memory.workingSet - baseline.memory.workingSet;
    assert(allocationJump > 180 * MiB && allocationJump < 240 * MiB, `Same-cell working set must rise by about 200 MiB, got ${allocationJump / MiB}`);
    assert(allocated.footerBytes - baseline.footerBytes > 100 * MiB, "The very next provider request must see the allocation despite the long telemetry interval");

    const filesystem = (await statfs(tempRoot)).type;
    if ([0x01021994, 0x858458f6].includes(filesystem)) { // tmpfs / ramfs have no disk-backed cold-file cache.
      console.log("PASS real SDK/Gateway/stdlib REPL: same-cell memory footer and 200 MiB working-set allocation; no paid calls");
      console.log(`SKIP page-cache exclusion: fixture filesystem 0x${filesystem.toString(16)} is memory-backed; use a disk-backed TMPDIR to exercise cgroup file-cache charging`);
      return;
    }

    const cached = await run("cold-file read charges cache, not working set", `with feedback_file.open('rb', buffering=0) as file:
    os.posix_fadvise(file.fileno(), 0, 0, os.POSIX_FADV_SEQUENTIAL)
    read_buffer = bytearray(1024 ** 2)
    read_bytes = 0
    while True:
        count = file.readinto(read_buffer)
        if count == 0:
            break
        read_bytes += count
    assert read_bytes == 256 * 1024 ** 2
del read_buffer
gc.collect()
print('CACHE_READ_READY')`);
    const cacheCurrentJump = cached.memory.current - allocated.memory.current;
    const cacheWorkingSetJump = cached.memory.workingSet - allocated.memory.workingSet;
    assert(cacheCurrentJump > 200 * MiB, "The owned cold-file read must charge this kernel's real cgroup (requires a disk-backed fixture directory)");
    assert(Math.abs(cacheWorkingSetJump) < 48 * MiB, "Reclaimable page cache must not inflate working-set pressure by 256 MiB");
    assert(cached.memory.current - cached.memory.workingSet > 200 * MiB, "Gateway preserves total charges separately from working set");
    assert(Math.abs(cached.footerBytes - allocated.footerBytes) < 128 * MiB, "The model footer uses working set rather than inflated current charges");
    console.log(JSON.stringify({ allocationJumpMiB: allocationJump / MiB, cacheCurrentJumpMiB: cacheCurrentJump / MiB, cacheWorkingSetJumpMiB: cacheWorkingSetJump / MiB, measurements }));
    console.log("PASS real Pi ModelRuntime/faux provider + Gateway socket + scoped stdlib REPL: actual cgroup prompt, same-cell one-decimal footer, and page-cache charges excluded from working set; no paid calls");
  })();
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); await rm(home, { recursive: true, force: true }); }
