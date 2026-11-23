import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareRgArtifact } from "../fixtures/rg-artifact.mjs";
import { TARGET_MODULE_SOURCES } from "../../src/target-channel/deployment-source/assemble-runtime-source.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";

assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");

const execFileAsync = promisify(execFile);

// Part 1: remoteExtensions unscoped fallback when systemd user bus is unavailable (e.g. `sudo su -` / container).
{
  const openSocketPath = resolve("src/remote-extensions/host/connection/open-control-socket.mjs");
  const telemetryPath = resolve("src/remote-extensions/memory/start-telemetry.mjs");
  const { stdout } = await execFileAsync(process.env.PI_TEST_PYTHON, ["-c", String.raw`
import json, os, pathlib, signal, sys, tempfile, threading, time, uuid

module = {"__name__": "<run_path>"}
exec(compile(sys.argv[1], "target_channel/remoteExtensions.py", "exec"), module)
open_socket_url = pathlib.Path(sys.argv[3]).as_uri()
telemetry_url = pathlib.Path(sys.argv[4]).as_uri()

with tempfile.TemporaryDirectory(prefix="prk-unscoped-host-") as root:
    host = pathlib.Path(root, "host.mjs")
    child_pid_file = pathlib.Path(root, "bg-child.pid")
    host.write_text(f"""import {{ spawn }} from "node:child_process";
import {{ writeFileSync }} from "node:fs";
import {{ openControlSocket }} from {json.dumps(open_socket_url)};
import {{ startMemoryTelemetry }} from {json.dumps(telemetry_url)};

const ctx = {{}};
await openControlSocket(ctx);
let published = 0;
const telemetry = startMemoryTelemetry(200, () => {{ published += 1; }});
const bg = spawn("sleep", ["300"], {{ stdio: "ignore" }});
writeFileSync({json.dumps(str(child_pid_file))}, JSON.stringify({{ hostPid: process.pid, bgPid: bg.pid, published }}));
ctx.lines.on("line", (line) => {{
  ctx.socket.write(line + "\\n");
}});
process.on("SIGTERM", () => {{ /* force killpg escalation check or clean group signal */ }});
setInterval(() => {{}}, 1000);
""")
    logs = []
    echoed = threading.Event()
    def emit(event):
        if event.get("t") == "log":
            logs.append(event.get("data", ""))
        if event.get("t") == "frameChunk" and event.get("last") and json.loads(module["base64"].b64decode(event["data"])) == {"ping": 1}:
            echoed.set()

    target = module["create"](emit)
    generation = uuid.uuid4().hex
    try:
        started = module["start"](target, {
            "generation": generation,
            "runtime": sys.argv[2],
            "runtimeArgs": ["--optimize-for-size"],
            "host": str(host),
            "cwd": root,
            "env": {
                "DBUS_SESSION_BUS_ADDRESS": "unix:path=/nonexistent-prk-dbus",
                "XDG_RUNTIME_DIR": root,
            },
            "memoryMax": 536870912,
            "memorySwapMax": 0,
        })
        assert started.get("scoped") is False, f"expected scoped=False, got {started}"
        deadline = time.monotonic() + 5
        while not child_pid_file.exists() and time.monotonic() < deadline:
            time.sleep(0.02)
        info = json.loads(child_pid_file.read_text())
        assert info["published"] == 0, "unscoped host must not fabricate cgroup memory samples"
        child = target.children[generation]
        module["send_frame"](child, {"ping": 1})
        assert echoed.wait(5), "unscoped host duplex socket must work"
        os.kill(info["bgPid"], 0)
        module["stop"](target, generation)
        assert not module["is_scope_populated"](child), "process group must be empty after stop"
        try:
            os.kill(info["bgPid"], 0)
            raise AssertionError("background child in host process group survived stop")
        except ProcessLookupError:
            pass
        assert any("unscoped" in entry for entry in logs), f"expected fallback log, got {logs}"
        print("UNSCOPED_REMOTE_HOST_OK")
    finally:
        target.shutdown()
`, `PROCESS_LIMITS = ${JSON.stringify(parseProcessWindowLimits())}\n${TARGET_MODULE_SOURCES.remoteExtensions}`, process.execPath, openSocketPath, telemetryPath], { timeout: 30_000 });
  assert.match(stdout, /UNSCOPED_REMOTE_HOST_OK/);
}

// Part 2: The owned REPL falls back on a broken user bus without claiming cgroup enforcement.
const home = await mkdtemp(join(tmpdir(), "prk-unscoped-kernel-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");

try {
  const targetCwd = join(home, "work");
  await mkdir(targetCwd);
  await prepareRgArtifact(home);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "unscoped-check", models: [{ id: "m" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);

  const host = await createGatewayHost({
    cwd: home,
    home,
    config: parsePrkConfig({ session: { workerTools: "code", localTools: false, noSkills: true }, memory: { review: false }, targetCacheRoot: join(home, "cache") }),
    historyDir: join(home, "history"),
    model: "unscoped-check/m",
    targets: [executionTargetFromConfig({ id: "target", label: "Unscoped target", local: false, python: process.env.PI_TEST_PYTHON,
      sshCommand: `HOME=${quoteShell(home)} DBUS_SESSION_BUS_ADDRESS=unix:path=/nonexistent-prk-dbus XDG_RUNTIME_DIR=${quoteShell(join(home, "no-xdg"))} exec /bin/sh`, cwd: targetCwd })],
  }, { runtimeDependencies: { model: provider.getModel("m"), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
  const endpoint = await startGateway(host, join(home, "gateway.sock"));
  const client = await connectGateway(join(home, "gateway.sock"));

  try {
      const sessionId = (await client.request("createSession", { target: "target" })).session.sessionId;
      let afterPrompt = "";
      let toolResult;
      const callId = randomUUID();
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall("kernel_code", { code: "print(21 * 2)" }, { id: callId }), { stopReason: "toolUse" }),
        (context) => {
          afterPrompt = getCurrentSystemPrompt(context.messages);
          toolResult = context.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === callId);
          return fauxAssistantMessage("ok");
        },
      ]);
      const op = await host.session(sessionId).submit({ requestId: randomUUID(), message: "compute" });
      assert.equal((await op.completion).status, "completed");
      assert.equal(Boolean(toolResult?.isError), false, JSON.stringify(toolResult));
      const out = toolResult.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
      assert.match(out, /42/);
      assert.doesNotMatch(out, /\[kernel memory /);
      assert.doesNotMatch(afterPrompt, /The kernel runs inside a cgroup/, "Unscoped prompt omits false cgroup claim");
      const snap = await client.request("state", { sessionId });
      assert.equal(snap.kernel.memory, undefined, "Unscoped REPL reports no fabricated cgroup memory");
    console.log("PASS unscoped fallback: remoteExtensions process-group + killpg fallback and REPL without cgroup claims");
  } finally {
    await client.disconnect();
    await endpoint.close();
  }
} finally {
  await rm(home, { recursive: true, force: true });
}
