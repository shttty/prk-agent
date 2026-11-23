import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../prepare-gateway-environment.mjs";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

/** Uses S4's proven public host/kernel seams; the native host owns models and sessions. */
export async function createAppHost(root, python, acquire, { idleTimeoutMs = 600000, firstSessionMessages } = {}) {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "s3-owned", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 100 }, () => fauxAssistantMessage("Owned terminal fixture conversation.")));
  const config = parsePrkConfig({ session: { noExtensions: true, localTools: false, idleTimeoutMs }, memory: { review: false }, monitor: { enabled: false } });
  const limits = parseProcessWindowLimits();
  const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({
    transport: await openProcessTransport(await acquire(), python, root, signal, config.targetConnection.startTimeoutMs, limits), command: "",
  }) });
  let host;
  try {
    const [first, second] = ["PTY session A", "PTY session B"];
    host = await createGatewayHost({ cwd: root, home: root, model: "s3-owned/controlled", config,
      targets: [executionTargetFromConfig({ id: "owned", label: "owned", local: true, python: python, cwd: root })],
    }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off", targetChannels: channels,
      createKernel: (hooks) => createPythonTool({ target: "owned", python, cwd: root, acquire, processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: false }, hooks),
    } });
    await prepareGatewayEnvironment(host, root, "owned");
    for (const label of [first, second]) {
      await host.createSession({ target: "owned", label, cwd: root }, (session) => {
        if (label !== first || !firstSessionMessages) return;
        for (const message of firstSessionMessages) {
          session.appendMessage(message.role === "assistant" ? { ...message, provider: "s3-owned", model: "controlled" } : message);
        }
      });
    }
    return host;
  } catch (error) { await host?.close(); throw error; }
}
