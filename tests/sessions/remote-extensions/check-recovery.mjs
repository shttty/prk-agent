import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { encode } from "../../../src/remote-extensions/codec/encode.mjs";

export async function checkExtensionRecovery({ targetRoot, call, until, delay, abort, exists, proof, activeGeneration, packages, native, name, host, updates, generations, control, disconnect, client, endpoint, configPath, instancesPath, agentDir, faux, root, home, historyDirectory, onCleanup, logs, ModelRuntime, createGatewayHost }) {
    // Stop a real LSP while initialization is pending, then abort the native tool.
    const pidFile = join(targetRoot, "workspace/lsp-pids");
    const oldPids = (await readFile(pidFile, "utf8")).trim().split("\n");
    const lspPending = call("lsp_diagnostics", { paths: ["example.ts"], server: "typescript" });
    const pids = await until(() => readFile(pidFile, "utf8").then((text) => text.trim().split("\n")), (next) => next.length > oldPids.length);
    const lspPid = Number(pids.at(-1));
    process.kill(lspPid, "SIGSTOP");
    await delay(100);
    await abort();
    await lspPending;
    await until(() => exists(`/proc/${lspPid}`), (alive) => !alive);
    proof("real-lsp-abort-and-close", { pid: lspPid, exited: true });
    const activeLsp = call("lsp_diagnostics", { paths: ["example.ts"], server: "typescript" });
    const nextPids = await until(() => readFile(pidFile, "utf8").then((text) => text.trim().split("\n")), (next) => next.length > pids.length);
    const drainingPid = Number(nextPids.at(-1));
    process.kill(drainingPid, "SIGSTOP");
    await activeGeneration(packages.lsp).close("reload");
    await activeLsp;
    await until(() => exists(`/proc/${drainingPid}`), (alive) => !alive);
    await native(name, "reload");
    assert.equal((await call("remote_probe", { action: "identity" })).details.sameManager, true);
    proof("active-lsp-shutdown-drain", { pid: drainingPid, exitedBeforeReplacement: true });
    const beforeCommit = updates.length;
    const sideEffect = call("remote_probe", { action: "side-effect" });
    await until(() => updates.slice(beforeCommit), (events) => events.some((event) => event.partialResult?.details?.committed === 1));
    const brokenGeneration = activeGeneration();
    const generationCount = generations.length;
    const disconnectedAt = Date.now();
    await disconnect(control[0].name);
    await sideEffect;
    assert(Date.now() - disconnectedAt < 10000);
    assert.equal(await readFile(join(targetRoot, "workspace/counter"), "utf8"), "1");
    await delay(100);
    assert.equal(generations.length, generationCount, "A lost control channel never recreates/replays a plugin callback");
    await native(name, "reload");
    const staleFrame = Buffer.from(JSON.stringify({ kind: "request", id: "old-side-effect", method: "execute", payload: encode({}) }));
    await assert.rejects(brokenGeneration.lease.request("remoteExtensions", "frameChunk", { generation: brokenGeneration.generation,
      offset: 0, total: staleFrame.length, last: true, data: staleFrame.toString("base64") }));
    assert.equal(await readFile(join(targetRoot, "workspace/counter"), "utf8"), "1");
    proof("disconnect-unknown-without-replay", { milliseconds: Date.now() - disconnectedAt, counter: 1 });
    const beforeRestart = host.state(name);
    const configBeforeRestart = await readFile(configPath, "utf8");
    const instancesBeforeRestart = await readFile(instancesPath, "utf8");
    await client.disconnect();
    await endpoint.close();
    const shutdowns = (await readFile(join(targetRoot, "workspace/lifecycle.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert(shutdowns.every((row) => row.sameManager));
    proof("shutdown-drain", { shutdowns });
    const restartedModelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    restartedModelRuntime.registerNativeProvider(faux.provider);
    const restarted = await createGatewayHost({ cwd: root, home, noSkills: true, historyDir: historyDirectory, model: "remote-extension-controlled/controlled", thinkingLevel: "off" }, {
      runtimeDependencies: { model: faux.getModel(), modelRuntime: restartedModelRuntime, thinkingLevel: "off", cwd: root, agentDir },
      onRemoteExtensionEvent: (event) => logs.push(event),
    });
    onCleanup(() => restarted.close());
    assert.equal(restarted.workbench().sessions.find((worker) => worker.sessionId === name)?.state, "sleeping");
    await restarted.wakeSession(name);
    const afterRestart = restarted.state(name);
    assert.equal(afterRestart.sessionId, beforeRestart.sessionId, "Gateway restart wakes the same SDK session");
    assert.notEqual(afterRestart.streamId, beforeRestart.streamId, "Waking the saved session establishes a new host stream");
    assert.equal(await readFile(configPath, "utf8"), configBeforeRestart, "UI revision allocation does not persist configuration metadata");
    assert.equal(await readFile(instancesPath, "utf8"), instancesBeforeRestart, "UI revision allocation does not persist instance metadata");
    const revisionMetadata = /"?(?:extensionUi(?:Revision|Generation)?|nextExtensionUiRevision|uiRevision)"?\s*[:=]/;
    assert.equal(revisionMetadata.test(configBeforeRestart), false);
    assert.equal(revisionMetadata.test(instancesBeforeRestart), false);
    const histories = (await readdir(historyDirectory, { recursive: true })).filter((file) => file.endsWith(".jsonl"));
    assert(histories.length > 0);
    for (const file of histories) assert.equal(revisionMetadata.test(await readFile(join(historyDirectory, file), "utf8")), false, `${file} has no persisted UI revision metadata`);
    proof("gateway-restart-host-stream", { sessionId: afterRestart.sessionId, before: beforeRestart.streamId, after: afterRestart.streamId, historyFiles: histories.length, persistedRevisionMetadata: false });
    await restarted.close();
}
