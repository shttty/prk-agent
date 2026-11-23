import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { ModelRuntime, CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { ArtifactStore } from "../../../src/artifacts/store/assemble-store.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { prepareNativeToolArtifacts } from "../../fixtures/native-tool-artifacts.mjs";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";
import { createHostFixture } from "./create-host-fixture.mjs";

export async function createGatewayFixture(mode, plugin, { extensionFilter, unscoped = false, onOwned } = {}) {
  const home = await mkdtemp(join(tmpdir(), "prk-S5-gateway-"));
  const owned = await createHostFixture(mode, new ArtifactStore(join(home, "assets")), undefined,
    { beforeExec: unscoped ? "os.environ['PRK_FORCE_UNSCOPED']='1'" : "" });
  onOwned?.({ home, root: owned.fixture.root, localRoot: owned.fixture.localRoot });
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await prepareNativeToolArtifacts(home);
  if (plugin !== undefined) {
    await owned.fixture.observe(`mkdir -p ${quoteShell(`${owned.fixture.root}/${CONFIG_DIR_NAME}/extensions`)}\n`);
    await owned.write(`${CONFIG_DIR_NAME}/extensions/s5.ts`, plugin);
  }
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const providerName = `s5-${randomUUID()}`;
  const provider = fauxProvider({ provider: providerName, models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const contexts = [];
  provider.setResponses(Array.from({ length: 100 }, () => (context) => {
    contexts.push(context);
    const last = context.messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : (last?.content ?? []).filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    const match = /^S5_TOOL (.*)$/su.exec(text);
    if (last?.role === "user" && match) { const { name, args } = JSON.parse(match[1]); return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" }); }
    return fauxAssistantMessage("Owned result observed.");
  }));
  const config = parsePrkConfig({ session: { noExtensions: false, localTools: false, workerTools: "direct", idleTimeoutMs: 600000 },
    extensions: extensionFilter, memory: { review: false }, monitor: { enabled: false }, remoteHost: { abortTimeoutMs: 250 } });
  const generations = [];
  let host;
  const close = async () => { try { await host?.close(); } finally { await owned.close(); await rm(home, { recursive: true, force: true }); } };
  try {
    host = await createGatewayHost({ cwd: home, home, model: `${providerName}/controlled`, config,
      targets: [executionTargetFromConfig({ id: "owned", label: "Owned S5 target", local: mode === "local", sshCommand: mode === "office" ? owned.fixture.command : undefined, python: mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON, cwd: owned.fixture.root })],
    }, { onRemoteExtensionGeneration: (generation) => generations.push(generation), runtimeDependencies: {
      cwd: home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off", targetChannels: owned.channels,
      createKernel: (hooks) => createPythonTool({ target: "owned", python: mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON,
        cwd: owned.fixture.root, acquire: () => owned.fixture.acquire(owned.id), processWindow: config.processWindow,
        memoryMax: "1G", memorySwapMax: "0", scoped: false }, hooks),
    } });
    await prepareGatewayEnvironment(host, home, "owned", { prepareArtifacts: false });
    const created = await host.createSession({ target: "owned", cwd: owned.fixture.root });
    const sessionId = created.session.sessionId;
    return { host, sessionId, owned, generations, provider, contexts, close,
      submit: (name, args) => host.session(sessionId).submit({ requestId: randomUUID(), message: `S5_TOOL ${JSON.stringify({ name, args })}` }),
    };
  } catch (error) { await close(); throw error; }
}
