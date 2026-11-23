import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";
import { startWebDev } from "../../fixtures/web-dev.mjs";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function createWebFixture(target, kernelTools = {}) {
  const limits = parseProcessWindowLimits();
  const { agentDir } = initializePrkHome(target.home);
  await mkdir(agentDir, { recursive: true });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "s4-owned", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 200 }, () => (context) => {
    const last = context.messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : (last?.content ?? []).filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
    const match = /^S4_CELL (.*)$/su.exec(text);
    if (last?.role === "user" && match) return fauxAssistantMessage(fauxToolCall("kernel_code", JSON.parse(match[1])), { stopReason: "toolUse" });
    return fauxAssistantMessage("Owned kernel result observed.");
  }));
  const config = parsePrkConfig({ session: { noExtensions: true, localTools: false, idleTimeoutMs: 600000 }, memory: { review: false }, monitor: { enabled: false }, kernelTools });
  const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({
    transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, config.targetConnection.startTimeoutMs, limits), command: "",
  }) });
  let host, gateway, client, web, ui;
  const close = async () => {
    await ui?.close(); await web?.close(); client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
  };
  try {
    host = await createGatewayHost({ cwd: target.home, home: target.home, model: "s4-owned/controlled", config,
      targets: [executionTargetFromConfig({ id: "s4", label: "s4", local: target.local, python: target.python, sshCommand: target.sshCommand, cwd: target.root })],
    }, { runtimeDependencies: { cwd: target.home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off", targetChannels: channels,
      createKernel: (hooks) => createPythonTool({ target: "s4", python: target.python, cwd: target.root, acquire: target.acquire,
        processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: false }, hooks),
    } });
    await prepareGatewayEnvironment(host, target.home, "s4");
    const socket = join(target.home, "g.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const created = await host.createSession({ target: "s4", cwd: target.root });
    const restartWeb = async () => {
      await ui?.close(); await web?.close();
      web = await startWebApplication({ host: "127.0.0.1", port: 0, socket, home: target.home, artifacts: config.artifacts, gateway: config.gateway });
      ui = await startWebDev(web.server.url, { host: "127.0.0.1" });
    };
    await restartWeb();
    return { host, client, get url() { return ui.url; }, get apiUrl() { return web.server.url; }, sessionId: created.session.sessionId, socket, restartWeb, close };
  } catch (error) { await close(); throw error; }
}
