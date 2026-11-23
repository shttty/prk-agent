import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createObservedChannels } from "../fixtures/target-environment/create-observed-channels.mjs";

async function until(read, label) {
  const deadline = Date.now() + 20000;
  while (!await read()) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await new Promise((done) => setTimeout(done, 30));
  }
}
await withTargetFixture(async ({ config, tempRoot }) => {
  const home = await mkdtemp(join(tmpdir(), "prk-monitor-targets-"));
  let host;
  try {
    const modelRuntime = await ModelRuntime.create({ authPath: join(home, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "monitor-target-check", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    // Explicit local and shell instances each own one shared process channel.
    const observed = createObservedChannels((id) => host.getTarget(id), { startTimeoutMs: 15000 });
    host = await createGatewayHost({
      cwd: home, home, model: "monitor-target-check/controlled", historyDir: join(home, "history"),
      config: parsePrkConfig({ targetConnection: { startTimeoutMs: 15000 }, monitor: { slowIntervalMs: 60000 } }),
      targets: [
        executionTargetFromConfig({ ...config, id: "local", label: "local", local: true, cwd: tempRoot }),
        executionTargetFromConfig({ ...config, id: "tunnel", label: "tunnel", local: false, sshCommand: "/bin/sh", cwd: tempRoot }),
      ],
    }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir: home, targetChannels: observed.channels, targetEnvironments: observed.environments } });
    const local = (await host.createSession({ target: "local" })).session.sessionId;
    const shared = (await host.createSession({ target: "local" })).session.sessionId;
    const tunnel = (await host.createSession({ target: "tunnel" })).session.sessionId;
    const monitor = (name) => host.workbench().sessions.find((worker) => worker.sessionId === name)?.monitor;
    await until(() => [local, shared, tunnel].every((name) => monitor(name)?.state === "ok" && monitor(name)?.machine), "both instance collectors deliver machine samples");
    assert.equal(observed.active().length, 2, "One real collector channel per target, including local sessions");
    for (const name of [local, shared, tunnel]) {
      assert(monitor(name).machine.cpu.cores > 0);
      assert(monitor(name).machine.mem.total > 0);
      assert.deepEqual(await host.workspace("terminalsList", name, {}), { terminals: [] }, "Collectors are not user terminals");
    }
    await host.closeSession(tunnel);
    await until(() => observed.active().length === 1, "closing the target's last session releases its collector");
    assert.equal(monitor(local).state, "ok", "Another target remains monitored");
    await host.closeSession(local);
    assert.equal(observed.active().length, 1, "A shared collector survives its remaining session");
    await host.closeSession(shared);
    await until(() => observed.active().length === 0, "all collectors release their owned process channels");
    assert.equal(provider.state.callCount, 0, "Monitoring starts no model request");
    console.log("PASS real Gateway monitoring: local/shell collectors, sharing and cleanup, zero model calls");
  } finally {
    await host?.close();
    await rm(home, { recursive: true, force: true });
  }
}, { allowHidden: true });
