import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { TargetUnreachableError } from "../../src/target-channel/connection-error/create-target-unreachable-error.ts";
import { targetConnectionError } from "../../src/target-channel/connection-error/classify-target-connection-error.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../src/config/target-connection/target-connection-options.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../src/config/kernel/kernel-options.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";

const root = await mkdtemp(join(tmpdir(), "prk-unreachable-"));
const connection = { local: false, sshCommand: "exec /bin/sh", python: process.env.PI_TEST_PYTHON, cwd: root };
let offline = false;
const environments = createTargetEnvironments({
  resolve: () => ({ local: false, command: offline ? "exit 71" : connection.sshCommand }),
  targetCacheRoot: join(root, "target-cache"),
});
const processWindow = parseProcessWindowLimits();
const opens = [];
const channels = createTargetChannels({
  options: { ...DEFAULT_TARGET_CONNECTION_OPTIONS, processWindow },
  async open(_machine, signal) {
    opens.push(performance.now());
    return { transport: await openProcessTransport(await environments.acquire("offline"), connection.python, root, signal, DEFAULT_TARGET_CONNECTION_OPTIONS.startTimeoutMs, processWindow), command: "" };
  },
});
let host;
let monitor, consumer;
try {
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "unreachable", models: [{ id: "controlled" }] });
  runtime.registerNativeProvider(provider.provider);
  host = await createGatewayHost({
    cwd: root, home: root, historyDir: join(root, "history"), model: "unreachable/controlled",
    targets: [executionTargetFromConfig({ ...connection, id: "offline", label: "Offline fixture", tags: [] })],
  }, { runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: root, agentDir: join(root, "agent"), targetChannels: channels, targetEnvironments: environments } });
  await prepareGatewayEnvironment(host, root, "offline");
  const saved = await host.createSession({ target: "offline", cwd: root });
  await host.closeSession(saved.session.sessionId);
  const reachable = await environments.acquire("offline");
  offline = true;
  try { await reachable.retire(new Error("Owned fixture disconnected")); }
  finally { await reachable.release(); }
  // Long-lived consumers do not revive a failed generation.
  monitor = channels.acquire("offline");
  consumer = channels.acquire("offline");
  const pendingFailure = consumer.request("skills", "discover", { cwd: root }).then(() => undefined, (error) => error);
  const started = performance.now();
  let recoveryTimer;
  let recovered;
  try {
    recovered = await Promise.race([
      host.recoverSession(saved.session.sessionId, { mode: "auto" }),
      new Promise((_, reject) => { recoveryTimer = setTimeout(() => reject(new Error("Recovery did not fail within five seconds")), 5000); }),
    ]);
  } finally { clearTimeout(recoveryTimer); }
  const elapsed = performance.now() - started;
  assert(elapsed < 5000, `Recovery must fail within five seconds, took ${elapsed.toFixed(0)} ms`);
  assert.equal(recovered.session.state, "unavailable");
  assert.equal(recovered.session.recovery.code, "TARGET_UNREACHABLE");
  // Both pending and later requests keep the typed failure on the retired generation.
  await assert.rejects(consumer.request("skills", "discover", { cwd: root }), TargetUnreachableError);
  assert.equal(monitor.state().state, "error", "Connection failure immediately retires the generation");
  const attempts = opens.length;
  await consumer.release();

  const python = createPythonTool({ target: "offline", python: connection.python, cwd: root, acquire: () => environments.acquire("offline"), processWindow, scoped: true, memoryMax: DEFAULT_KERNEL_OPTIONS.memoryMax, memorySwapMax: DEFAULT_KERNEL_OPTIONS.memorySwapMax }, { codeMode: true });
  try { await assert.rejects(python.ensure(), (error) => error instanceof TargetUnreachableError && error.code === "TARGET_UNREACHABLE"); }
  finally { await python.close(); }
  assert(await pendingFailure instanceof TargetUnreachableError);
  for (const code of ["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"]) {
    assert(targetConnectionError(new Error("network", { cause: Object.assign(new Error("socket"), { code }) }), "offline") instanceof TargetUnreachableError);
  }
  assert.equal(targetConnectionError(new Error("scope prerequisite failed"), "offline"), undefined);
  assert.equal(targetConnectionError(new DOMException("cancelled", "AbortError"), "offline"), undefined);

  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.equal(opens.length, attempts, "Long-lived failed consumers cause no background reconnect");
  console.log(`PASS target unreachable: real session recovery ${elapsed.toFixed(0)} ms, typed immediate failure, no background reconnect`);
} finally {
  await consumer?.release();
  await monitor?.release();
  await host?.close();
  await rm(root, { recursive: true, force: true });
}
