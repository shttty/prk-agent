import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

if (process.argv.includes("--child")) {
  if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("This exit check requires an owned random-port Jupyter fixture.");
  const home = await mkdtemp(join(tmpdir(), "prk-gateway-exit-"));
  const { agentDir } = initializePrkHome(home);
  try {
    const extensionPackage = join(home, "exit-package");
    await mkdir(extensionPackage);
    await writeFile(join(extensionPackage, "package.json"), JSON.stringify({ name: "prk-exit-package", version: "1.0.0", type: "module", pi: { extensions: ["exit-resource.ts"] } }));
    const settingsPath = join(agentDir, "settings.json");
    await mkdir(agentDir, { recursive: true });
    const settingsSource = JSON.stringify({ packages: [{ source: "../exit-package", enabled: true, location: "gateway" }] });
    await writeFile(settingsPath, settingsSource);
    // The configured SDK package owns a real referenced resource and releases
    // it only through the public shutdown lifecycle, as provider packages must.
    await writeFile(join(extensionPackage, "exit-resource.ts"), `export default function (pi) {
      let timer;
      pi.on("before_agent_start", () => {
        if (timer) return;
        timer = setInterval(() => {}, 60000);
        console.log("OWNED_EXTENSION_STARTED");
      });
      pi.on("session_shutdown", async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        clearInterval(timer);
        console.log("OWNED_EXTENSION_SHUTDOWN");
      });
    }`);
    // The selected home is bound before any SDK/provider/bootstrap import.
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    const provider = fauxProvider({ provider: "gateway-exit-controlled", models: [{ id: "local" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    provider.setResponses(Array.from({ length: 6 }, () => async (context) => {
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Observed real owned kernel result.");
      const user = context.messages.findLast((message) => message.role === "user");
      const text = typeof user.content === "string" ? user.content : user.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      if (text === "Execute owned kernel proof.") return fauxAssistantMessage(fauxToolCall("kernel_code", { code: "exit_counter = 40\nexit_counter += 2", title: "Process exit proof" }), { stopReason: "toolUse" });
      return fauxAssistantMessage("Worker lifecycle proof, without execution.");
    }));
    await withTargetFixture(async ({ config, onCleanup }) => {
      const target = executionTargetFromConfig({ ...config, id: "exit-target", label: "Owned exit target", local: true, tags: [], cwd: home });
      const host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig({ session: { workerTools: "code", noExtensions: false } }), historyDir: join(home, "history"), model: "gateway-exit-controlled/local", thinkingLevel: "off", targets: [target] }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
      onCleanup(() => host.close());
      await prepareGatewayEnvironment(host, home, target.id);
      const first = (await host.createSession({ target: target.id, cwd: home, label: "First lifecycle worker" })).session.sessionId;
      const firstHost = host.session(first);
      const firstRun = await firstHost.submit({ requestId: "first-worker-exit-proof", message: "Observe worker lifecycle." });
      assert(firstRun.accepted);
      assert.equal((await firstRun.completion).status, "completed");
      const worker = (await host.createSession({ target: target.id, cwd: home, label: "Kernel lifecycle worker" })).session.sessionId;
      const workerHost = host.session(worker);
      const run = await workerHost.submit({ requestId: "worker-exit-proof", message: "Execute owned kernel proof." });
      assert(run.accepted);
      assert.equal((await run.completion).status, "completed");
      const result = workerHost.getSnapshot().messages.findLast((message) => message.role === "toolResult");
      assert.equal(result.toolName, "kernel_code");
      assert.equal(result.isError, false);
      assert.equal(host.state(worker).kernel.state, "idle");
      await host.close();
      assert.equal(firstHost.getSnapshot().state, "closed");
      assert.equal(workerHost.getSnapshot().state, "closed");
      // Gateway shutdown releases owned kernels and leaves every worker sleeping.
      const stopped = host.workbench().sessions;
      assert.equal(stopped.length, 2);
      assert(stopped.every((entry) => entry.state === "sleeping"), JSON.stringify(stopped));
      for (const name of [first, worker]) assert.ok(!host.state(name).kernel || host.state(name).kernel.state === "closed", JSON.stringify(host.state(name).kernel));
    });
    assert.equal(await readFile(settingsPath, "utf8"), settingsSource, "SDK/session overrides must not write the selected home settings.");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
  console.log("OWNED_CLEANUP_DONE");
} else {
  const env = { ...process.env };
  delete env.JUPYTER_URL;
  delete env.JUPYTER_TOKEN;
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--child"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", cleanupSeen = false, exitDeadline, timedOut = false;
  const timeout = () => { timedOut = true; child.kill("SIGTERM"); };
  const startupDeadline = setTimeout(timeout, 45000);
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    if (!cleanupSeen && stdout.includes("OWNED_CLEANUP_DONE")) {
      cleanupSeen = true;
      clearTimeout(startupDeadline);
      exitDeadline = setTimeout(timeout, 3000);
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let outcome;
  try {
    outcome = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", (code, signal) => resolve({ code, signal })); });
  } finally {
    clearTimeout(startupDeadline);
    clearTimeout(exitDeadline);
  }
  assert(!timedOut, `Gateway child must naturally exit within 3s of actual owned cleanup.\n${stdout}\n${stderr}`);
  assert.deepEqual(outcome, { code: 0, signal: null }, `${stdout}\n${stderr}`);
  assert(cleanupSeen, "Real Gateway/session/kernel/fixture/home cleanup must finish before child exit.");
  assert.equal(stdout.split("OWNED_EXTENSION_STARTED").length - 1, 2, "Both workers acquire a real extension resource.");
  assert.equal(stdout.split("OWNED_EXTENSION_SHUTDOWN").length - 1, 3, "The directory session and both workers await public asynchronous shutdown before disposal.");
  console.log("PASS: actual Gateway worker/kernel cleanup naturally exits its child process; public extension shutdown is awaited; zero paid calls.");
}
