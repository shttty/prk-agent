import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { createHostFixture } from "../target-environment/host/create-host-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const machine = process.argv[2] ?? "local";
const root = await mkdtemp(join(tmpdir(), "prk-host-isolation-"));
const previousHome = process.env.HOME;
process.env.HOME = root;
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
let host;
let fixture;
const entered = Promise.withResolvers();
const pong = Promise.withResolvers();
const generations = [];
try {
  await prepareNativeToolArtifacts(home);
  await mkdir(agentDir, { recursive: true });
  const source = join(root, "plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/host-isolation", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(source, "index.mjs"), `export default pi => {
pi.registerTool({name:"host_loop",label:"Owned loop",description:"Owned synchronous isolation fixture",parameters:{type:"object",properties:{}},execute(){console.log("OWNED_LOOP_ENTER "+process.pid);while(true){}}});
pi.registerCommand("host_ping",{handler:async(_args,ctx)=>{console.log("OWNED_HOST_PONG "+process.pid);ctx.ui.notify("OWNED_HOST_PONG "+process.pid);}});
};\n`);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "host" }], compaction: { enabled: false }, retry: { enabled: false } }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "owned-isolation", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  fixture = await createHostFixture(machine, new ArtifactStore(join(home, "assets")));
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, remoteHost: { runtime: "node" }, session: { noExtensions: false, noSkills: true, idleTimeoutMs: 60000 } }, { instances: [{ id: "owned", label: "Owned isolation", local: machine === "local", ...(machine === "office" ? { sshCommand: fixture.fixture.command } : {}), python: machine === "office" ? process.env.PI_TEST_REMOTE_PYTHON : process.env.PI_TEST_PYTHON, cwd: fixture.fixture.root }] });
  host = await createGatewayHost({ cwd: home, home, config, targets: config.instances, model: "owned-isolation/controlled", thinkingLevel: "off" }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: fixture.channels },
    onRemoteExtensionGeneration(generation, context) { if (context.sessionId) generations.push({ sessionId: context.sessionId, pid: generation.registration.pid }); },
    onRemoteExtensionEvent(event) { const text = String(event.data); const loop = /OWNED_LOOP_ENTER (\d+)/.exec(text); if (loop) entered.resolve(Number(loop[1])); const ping = /OWNED_HOST_PONG (\d+)/.exec(text); if (ping) pong.resolve(Number(ping[1])); },
  });
  await prepareGatewayEnvironment(host, home, "owned");
  const first = (await host.createSession({ target: "owned", cwd: fixture.fixture.root })).session.sessionId;
  const second = (await host.createSession({ target: "owned", cwd: fixture.fixture.root })).session.sessionId;
  provider.setResponses([fauxAssistantMessage(fauxToolCall("host_loop", {}, { id: randomUUID() }), { stopReason: "toolUse" }), fauxAssistantMessage("Loop cancelled")]);
  const loop = await host.session(first).submit({ requestId: randomUUID(), message: "Execute the owned loop fixture" });
  const frozenPid = await entered.promise;
  assert.notEqual(frozenPid, process.pid);
  assert((await host.modelCatalog()).models.length > 0, "Gateway responds while host is synchronously blocked");
  const ping = await host.session(second).submit({ requestId: randomUUID(), message: "/host_ping" });
  assert.equal((await ping.completion).status, "completed");
  const responsivePid = await pong.promise;
  assert.notEqual(responsivePid, frozenPid);
  assert.notEqual(responsivePid, process.pid);
  await host.session(first).cancel({ operationId: loop.operationId });
  assert.equal((await loop.completion).status, "cancelled");
  console.log(JSON.stringify({ proof: "synchronous host while(true) leaves Gateway and second native session host responsive", machine, gatewayPid: process.pid, frozenPid, responsivePid, generations }));
} finally {
  await host?.close(); await fixture?.close();
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
