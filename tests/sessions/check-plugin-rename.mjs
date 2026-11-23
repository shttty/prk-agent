import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { createSessionRuntime } from "../../src/sessions/runtime/assemble-runtime.ts";

const home = await mkdtemp(join(tmpdir(), "prk-plugin-rename-"));
try {
  const { agentDir } = initializePrkHome(home);
  const models = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "plugin-rename-proof", models: [{ id: "controlled" }] });
  models.registerNativeProvider(provider.provider);
  await withTargetFixture(async ({ config, onCleanup }) => {
    let sdkSession;
    const host = await createGatewayHost({
      home, cwd: home, model: "plugin-rename-proof/controlled",
      config: parsePrkConfig({ monitor: { enabled: false } }),
      targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Rename fixture", local: true, tags: [], cwd: home })],
    }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime: models, thinkingLevel: "off", autoCompaction: false, cwd: home, agentDir },
      collectionFactory: (targets, options) => createSessionCollection(targets, { ...options, sessionFactory: async (...args) => {
        const runtime = await createSessionRuntime(...args);
        sdkSession = runtime.session;
        return runtime;
      } }),
    });
    onCleanup(() => host.close());
    await prepareGatewayEnvironment(host, home, "fixture");
    const created = await host.createSession({ target: "fixture", label: "Original name" });
    const sessionId = created.session.sessionId;
    const events = [];
    const unsubscribe = host.subscribeSessions((event) => {
      if (event.type === "session_renamed" && event.sessionId === sessionId) events.push(event);
    });
    try {
      assert.equal(sdkSession.sessionId, sessionId);
      sdkSession.setSessionName("Plugin assigned name");
      assert.equal(host.history(sessionId).session.label, "Plugin assigned name", "The real SDK persisted session_info");
      assert.equal(events.length, 1, "Plugin setSessionName publishes a collection rename without refreshing");
      assert.equal(events[0].details.session.sessionId, sessionId);
      assert.equal(events[0].details.session.label, "Plugin assigned name", "Collection event carries the reread row");
    } finally {
      unsubscribe();
    }
  });
  console.log("PASS plugin rename: real SDK setSessionName publishes the updated collection row");
} finally {
  await rm(home, { recursive: true, force: true });
}
