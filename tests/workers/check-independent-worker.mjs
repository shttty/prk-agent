import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { createSessionRuntime } from "../../src/sessions/runtime/assemble-runtime.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

// Actual SDK creation racing collection closure must not leak a session/kernel.
await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-independent-worker-"));
  let racing;
  onCleanup(async () => {
    try { await racing?.close(); }
    finally { await ownedRuntime?.close(); await rm(root, { recursive: true, force: true }); }
  });
  let ownedRuntime;
  let ownedPid;
  const pidFile = join(root, "owned-repl.pid");
  const sessionFactory = async (...args) => {
    ownedRuntime = await createSessionRuntime(...args);
    const result = await ownedRuntime.kernel.tool.execute("record-owned-process", {
      code: `import os; open(${JSON.stringify(pidFile)}, 'w').write(str(os.getpid()))`,
    });
    assert.equal(result.isError, undefined);
    ownedPid = Number(await readFile(pidFile, "utf8"));
    assert(Number.isSafeInteger(ownedPid) && ownedPid > 0);
    return ownedRuntime;
  };
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const faux = fauxProvider({ provider: "independent-check", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });
  modelRuntime.registerNativeProvider(faux.provider);
  const model = faux.getModel();
  const targets = [executionTargetFromConfig({ ...config, id: "shared", label: "Shared instance", tags: [], cwd: root })];
  const dependenciesGate = Promise.withResolvers();
  racing = createSessionCollection(targets, { getRuntimeDependencies: () => dependenciesGate.promise, sessionFactory });
  const creating = racing.create("shared", SessionManager.inMemory(root), {});
  const closing = racing.close();
  dependenciesGate.resolve({ model, modelRuntime, thinkingLevel: "low", cwd: root, agentDir: root });
  await assert.rejects(creating, /closed during creation/);
  await closing;
  assert.equal(racing.list()[0].state, "closed");
  assert.equal(ownedRuntime.kernel.getSnapshot().state, "closed");
  assert.throws(() => process.kill(ownedPid, 0), { code: "ESRCH" }, "Creation versus close must release the owned REPL process");
  console.log("PASS: actual SDK worker creation versus collection close releases owned resources");
});
