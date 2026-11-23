import assert from "node:assert/strict";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { createSessionRuntime } from "../../src/sessions/runtime/assemble-runtime.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ config, tempRoot: root }) => {
  const target = executionTargetFromConfig({ id: "target", label: "Recovery instance", ...config });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "offline", models: [{ id: "controlled" }] });
  modelRuntime.registerNativeProvider(provider.provider);
  let collection;
  let creations = 0;
  let closes = 0;
  let rejectCreation = false;
  const countedFactory = async (...args) => {
    if (rejectCreation) throw new Error("controlled runtime creation failure");
    const runtime = await createSessionRuntime(...args);
    creations += 1;
    return { ...runtime, close: async () => { closes += 1; await runtime.close(); } };
  };
  const host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"),
    model: "offline/controlled", targets: [target] }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root },
    collectionFactory: (targets, options) => {
      collection = createSessionCollection(targets, { ...options, sessionFactory: countedFactory });
      return collection;
    },
  });
  try {
    await prepareGatewayEnvironment(host, root, "target");
    const created = await host.createSession({ target: "target" });
    const sessionId = created.session.sessionId;
    assert.equal(created.session.recovery, undefined, "Fresh live sessions do not claim an unavailable recovery state");
    const firstRuntime = collection.get(sessionId);
    await firstRuntime.kernel.ensure();
    const originalKernelId = firstRuntime.kernel.getSnapshot().kernelId;
    assert(originalKernelId, "The real owned REPL has an execution identity");
    await assert.rejects(host.recoverSession(sessionId, { mode: "new", target: "target" }),
      (error) => error.code === "BUSY", "A stale client cannot replace another client's live runtime");
    assert.equal(collection.get(sessionId).kernel.getSnapshot().kernelId, originalKernelId);
    assert.equal(creations, 1);
    assert.equal(closes, 0);

    await host.closeSession(sessionId);
    assert.equal(firstRuntime.kernel.getSnapshot().state, "closed", "Closing a session closes its owned REPL");
    rejectCreation = true;
    const failed = await host.recoverSession(sessionId, { mode: "auto" });
    assert.equal(failed.session.recovery.status, "unavailable");
    assert.equal(failed.session.sessionId, sessionId, "Failed recovery preserves native identity");
    assert.equal(collection.snapshot().find((session) => session.sessionId === sessionId).state, "closed");
    rejectCreation = false;
    const recovered = await host.recoverSession(sessionId, { mode: "auto" });
    assert.equal(recovered.session.recovery.status, "new", "Automatic recovery creates a fresh runtime, never adopts an old handle");
    assert.equal(recovered.session.sessionId, sessionId);
    assert.equal(recovered.session.target, "target");
    assert.equal(recovered.session.cwd, root);
    const secondRuntime = collection.get(sessionId);
    await secondRuntime.kernel.ensure();
    assert.notEqual(secondRuntime.kernel.getSnapshot().kernelId, originalKernelId);
    assert.equal(creations, 2);
    await host.closeSession(sessionId);
    const selected = await host.recoverSession(sessionId, { mode: "new", target: "target", cwd: root });
    assert.equal(selected.session.recovery.status, "new");
    assert.equal(selected.session.sessionId, sessionId);
    assert.equal(creations, 3);
  } finally { await host.close(); }
});
console.log("PASS recovery runtime: owned REPL teardown, live replacement refusal, failed recovery retry, and fresh auto/new runtimes preserve native identity");
