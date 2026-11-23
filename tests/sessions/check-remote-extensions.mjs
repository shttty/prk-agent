import { stringify } from "smol-toml";
import { checkPackageOrderFingerprint } from "./remote-extensions/check-package-order-fingerprint.mjs";
import { prepareLspWorkspace } from "./remote-extensions/prepare-lsp-workspace.mjs";
import { until } from "./remote-extensions/wait-condition.mjs";
import { checkTargetTools } from "./remote-extensions/check-target-tools.mjs";
import { checkExtensionRecovery } from "./remote-extensions/check-recovery.mjs";
import { checkToolInterception } from "./remote-extensions/check-tool-interception.mjs";
import { checkExtensionPlacement } from "./remote-extensions/check-placement.mjs";
// Formal acceptance: owned bundles + actual Gateway/Pi SDK/faux + one shared target process channel.
import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareRemoteExtensionStore } from "../fixtures/remote-extension-store.mjs";
import { encode } from "../../src/remote-extensions/codec/encode.mjs";
import { createObservedChannels } from "../fixtures/target-environment/create-observed-channels.mjs";

assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
try { execFileSync("bwrap", ["--version"], { stdio: "ignore" }); }
catch (cause) { throw new Error("bwrap is required: target-only path acceptance cannot run without a mount namespace.", { cause }); }
const root = await mkdtemp(join(tmpdir(), "prk-remote-extensions-"));
const evidence = resolve(process.env.PRK_REMOTE_EXTENSION_EVIDENCE ?? root);
await mkdir(evidence, { recursive: true });
const home = join(root, "gateway");
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const rows = [];
const logs = [];
// Bundle preparation belongs to the same cleanup scope as execution; retain evidence only via an external path.
try {
const { agentDir, configPath, instancesPath } = initializePrkHome(home);
await mkdir(join(agentDir, "extensions"), { recursive: true });
await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
// An ordinary local tool exercises reverse calls. It neither enables remote packages nor owns a channel.
await writeFile(join(agentDir, "extensions", "gateway-double.js"), `export default function(pi) { pi.registerTool({name:"gateway_double",label:"Gateway double",description:"Local reverse-call acceptance",parameters:{type:"object",properties:{value:{type:"number"}},required:["value"]},async execute(_id,{value},_signal,update){update?.({content:[{type:"text",text:"nested-update"}],details:{nestedUpdate:true}});return {content:[{type:"text",text:String(value*2)}],details:{value:value*2,pid:process.pid}}}}); }`);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { packages, bundlePaths, storeDir, bunSha256 } = await prepareRemoteExtensionStore(home, ["lsp", "languageServers", "capabilities", "capabilitiesV2"]);
for (const [key, pkg] of Object.entries(packages)) pkg.source = join(bundlePaths[key], "node_modules", pkg.name);
const { targetPackages } = checkPackageOrderFingerprint(packages);
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

const exists = async (path) => access(path).then(() => true, () => false);
const proof = (name, data) => { rows.push({ name, ...data }); console.log(JSON.stringify({ name, ...data })); };
const targetRoot = join(root, "target-storage");
await mkdir(join(targetRoot, "workspace"), { recursive: true });
const target = `/mnt/prk-remote-extensions-${process.pid}`;
assert.equal(await exists(target), false);
const wrapper = join(root, "target-shell");
const q = (s) => `'${s.replaceAll("'", "'\\''")}'`;
await writeFile(wrapper, `#!/bin/bash\nexec bwrap --ro-bind / / --bind ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} --bind ${q(root)} ${q(root)} --tmpfs /mnt --bind ${q(targetRoot)} ${q(target)} --dev /dev --proc /proc /bin/sh\n`);
await chmod(wrapper, 0o700);
await writeFile(join(targetRoot, "workspace/example.ts"), 'import { unused } from "./dep";\nconst broken: number = "TARGET_TYPE_ERROR";\nconsole.log(broken);\n');
await writeFile(join(targetRoot, "workspace/dep.ts"), "export const unused = 1;\n");
await writeFile(join(targetRoot, "workspace/tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noUnusedLocals: true }, include: ["*.ts"] }));
await writeFile(join(root, "example.ts"), "GATEWAY_SENTINEL\n");
  const sharedFixtureOptions = { tempParent: root };
  await withTargetFixture(async (fixtureB) =>
    withTargetFixture(async (fixtureLocal) => {
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const server = await prepareLspWorkspace({ tempRoot, bunSha256, bundlePaths, target, targetRoot, q, exists });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const faux = fauxProvider({ provider: "remote-extension-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(faux.provider);
    const generations = [];
    const updates = [];
    const modelResults = [];
    const declarations = [];
    const connections = { A: { ...config, cwd: `${target}/workspace` }, B: fixtureB.config, local: fixtureLocal.config };
    const instance = (name, local = false, cwd = connections[name].cwd) => ({ id: name, label: name, local, tags: [], python: connections[name].python,
      ...(local ? {} : { sshCommand: connections[name].sshCommand ?? `HOME=${q(connections[name].cwd)} exec /bin/sh` }), cwd });
    const workspaces = Object.fromEntries(Object.entries(connections).map(([name, connection]) => [name, connection.cwd]));
    assert.equal(new Set(Object.values(workspaces)).size, 3, "Each fixture has its own owned target workspace");
    proof("distinct-owned-instance-workspaces", { workspaces });
    const localCwd = join(root, "local-workspace");
    await mkdir(localCwd);
    const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false }, session: { noExtensions: false, bootstrapNoSkills: true, workerTools: "direct", idleTimeoutMs: 600000 } };
    const instanceDocument = { instances: [instance("A"), instance("B"), instance("local", true, localCwd)] };
    await writeFile(configPath, stringify(document));
    await writeFile(instancesPath, stringify(instanceDocument), { mode: 0o600 });
    const historyDirectory = join(home, "history");
    let host;
    const observed = createObservedChannels((id) => host.getTarget(id), { startTimeoutMs: 15000 });
    host = await createGatewayHost({ cwd: root, home, noSkills: true, historyDir: historyDirectory, model: "remote-extension-controlled/controlled", thinkingLevel: "off", config: parsePrkConfig(document, instanceDocument) }, {
      runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir, targetChannels: observed.channels, targetEnvironments: observed.environments },
      onRemoteExtensionEvent: (event) => logs.push(event),
      onRemoteExtensionGeneration: (generation, context) => generations.push({ ...context, host: generation }),
    });
    const socket = join(root, "gateway.sock");
    const endpoint = await startGateway(host, socket);
    onCleanup(() => endpoint.close());
    const client = await connectGateway(socket);
    onCleanup(() => client.disconnect());
    const subscribed = new Set();
    const watch = (worker) => {
      if (subscribed.has(worker)) return;
      subscribed.add(worker);
      host.session(worker).subscribe((event) => { if (event.details?.sdkType === "tool_execution_update") updates.push({ sessionId: worker, ...event.details }); });
    };
    const create = async (targetName) => { const created = await client.request("createSession", { target: targetName }); watch(created.session.sessionId); return created.session.sessionId; };
    const native = async (worker, action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const catalog = (worker) => native(worker, "capabilities");
    const controls = observed.active;
    const b = await create("B");
    assert.equal((await catalog(b)).entries.some((entry) => entry.id === "tool:lsp_diagnostics"), false, "B has no remote LSP registration");
    for (const { source, location } of targetPackages) await host.pluginsInstall({ source, location });
    const beforeA = controls();
    let name = await create("A");
    const activeGeneration = (pkg = packages.capabilities, worker = name) => generations.findLast((entry) => entry.sessionId === worker && entry.package === pkg.source)?.host;
    assert.deepEqual((await host.pluginsList()).packages.filter((pkg) => pkg.error), [], "No extension load errors are hidden");
    const aControls = controls();
    const control = aControls.filter((entry) => !beforeA.some((old) => old.name === entry.name));
    assert.equal(control.length, 1, "Two packages share exactly one Gateway-owned target process channel");
    const secondA = await create("A");
    assert.deepEqual(controls(), aControls, "Multiple sessions and packages share one target control process");
    proof("shared-control-channel", { instance: "A", sessions: [name, secondA], packages: [packages.lsp.name, packages.capabilities.name], channels: aControls, control: control[0].name });
    assert.equal((await catalog(name)).requiresReload, false, "The loaded package order matches the saved configuration");
    await host.pluginsUninstall({ source: packages.lsp.source, confirm: true });
    const reordered = await host.pluginsInstall({ source: packages.lsp.source, location: "host" });
    assert.deepEqual(reordered.packages.map(({ source }) => source), [packages.capabilities.source, packages.lsp.source]);
    assert.equal((await catalog(name)).requiresReload, true, "The real runtime catalog requires reload after reversing two target packages");
    assert.equal(host.state(name).requiresReload, true, "Package-order changes publish the existing runtime reload notice");
    await host.pluginsUninstall({ source: packages.capabilities.source, confirm: true });
    await host.pluginsInstall({ source: packages.capabilities.source, location: "host" });
    assert.equal((await catalog(name)).requiresReload, false, "Restoring the loaded package order clears the reload requirement without replacing the host");
    proof("package-order-requires-reload", { before: targetPackages.map((pkg) => pkg.source), after: [...targetPackages].reverse().map((pkg) => pkg.source), requiresReload: true });
    const call = async (toolName, args, worker = name) => {
      watch(worker);
      const toolCallId = randomUUID();
      faux.setResponses([(context) => { declarations.push(getCurrentTools(context.messages)); return fauxAssistantMessage(fauxToolCall(toolName, args, { id: toolCallId }), { stopReason: "toolUse" }); }, (context) => {
        modelResults.push(context.messages.filter((message) => message.role === "toolResult").at(-1));
        return fauxAssistantMessage("REMOTE_EXTENSION_DONE");
      }]);
      const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "REMOTE_EXTENSION_REQUEST", mode: "plain" });
      assert.equal(admission.accepted, true, JSON.stringify(admission));
      await admission.completion;
      const result = modelResults.findLast((message) => message?.toolCallId === toolCallId) ?? host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === toolCallId);
      assert(result, "Actual native tool result is required");
      return result;
    };
await checkTargetTools({ activeGeneration, packages, call, target, host, name, proof, storeDir, native, targetRoot, root, declarations, b, server, updates });
await checkToolInterception({ call, modelResults, updates, until, logs, proof });
    const abort = async () => { const operation = host.state(name).operation; assert(operation); await host.session(name).cancel({ operationId: operation.operationId }); };
    const beforeWait = updates.length;
    const waiting = call("remote_probe", { action: "wait" });
    await until(() => updates.slice(beforeWait), (events) => events.some((event) => event.partialResult?.details?.waiting));
    await abort();
    await waiting;
    assert((await readFile(join(targetRoot, "workspace/aborted.jsonl"), "utf8")).includes("reason"));
    proof("tool-abort", { recordedOnTarget: true });
    const firstGeneration = activeGeneration();
    const beforeUpgrade = host.state(name);
    await host.pluginsUninstall({ source: packages.capabilities.source, confirm: true });
    await host.pluginsInstall({ source: packages.capabilitiesV2.source, location: "host" });
    packages.capabilities = packages.capabilitiesV2;
    assert.equal(host.state(name).requiresReload, true);
    assert.equal((await call("remote_probe", { action: "identity" })).details.packageVersion, "1.0.0", "Saving an upgrade does not mutate the running SDK generation");
    await native(name, "reload");
    assert.notEqual(activeGeneration().generation, firstGeneration.generation);
    assert.notEqual(host.state(name).streamId, beforeUpgrade.streamId, "Replacing remote plugins also replaces the SDK host stream");
    assert.equal((await call("remote_probe", { action: "identity" })).details.sameManager, true);
    assert.equal((await call("remote_probe", { action: "identity" })).details.packageVersion, "2.0.0");
    assert.equal(host.state(name).sessionId, beforeUpgrade.sessionId);
    assert.equal(host.state(name).kernel.kernelId, beforeUpgrade.kernel.kernelId);
    assert.equal(host.state(name).requiresReload, false);
    const staleFrame = Buffer.from(JSON.stringify({ kind: "request", id: "stale", method: "snapshot", payload: encode({ revision: 999 }) }));
    await assert.rejects(firstGeneration.lease.request("remoteExtensions", "frameChunk", { generation: firstGeneration.generation,
      offset: 0, total: staleFrame.length, last: true, data: staleFrame.toString("base64") }));
    const oldSessionId = host.state(name).sessionId;
    const fresh = await native(name, "new");
    name = fresh.session.sessionId;
    watch(name);
    assert.notEqual(host.state(name).sessionId, oldSessionId);
    assert.equal((await call("remote_probe", { action: "identity" })).details.sessionId, host.state(name).sessionId);
    const retiredCallbacks = (await readFile(join(targetRoot, "workspace/stale-context.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert(retiredCallbacks.some((entry) => entry.pid === firstGeneration.registration.pid && entry.staleContext === true), "The retiring target host rejects its captured reverse callback");
    proof("native-reload-and-new-generation", { generations: generations.filter((entry) => entry.sessionId).map((entry) => ({ sessionId: entry.sessionId, package: entry.package, generation: entry.host.generation })), sessionId: host.state(name).sessionId, version: "2.0.0" });
await checkExtensionPlacement({ create, call, localCwd, generations, instance, packages, client, configPath, instancesPath, native, host, proof });
await checkExtensionRecovery({ targetRoot, call, until, delay, abort, exists, proof, activeGeneration, packages, native, name, host, updates, generations, control, disconnect: observed.disconnect, client, endpoint, configPath, instancesPath, agentDir, faux, root, home, historyDirectory, onCleanup, logs, ModelRuntime, createGatewayHost });
    await writeFile(join(evidence, "protocol-logs.json"), JSON.stringify(logs, null, 2));
  }, { sshCommand: q(wrapper), tempParent: root });
    }, sharedFixtureOptions), sharedFixtureOptions);
  await writeFile(join(evidence, "acceptance.json"), JSON.stringify({ status: "passed", rows, root }, null, 2));
  console.log(`REMOTE_EXTENSION_PASS ${evidence}`);
} catch (error) {
  await writeFile(join(evidence, "acceptance.json"), JSON.stringify({ status: "failed", rows, error: error.stack, logs, root }, null, 2));
  throw error;
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
