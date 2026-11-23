import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { createTarget } from "./fixtures/create-target.mjs";
import { prepareCodemodePackages } from "./fixtures/prepare-codemode-packages.mjs";
import { checkCodemodeFilters } from "./fixtures/check-codemode-filters.mjs";

const target = await createTarget("local"), home = target.home, cleanups = [];
try {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  const { callbackPackage, otherPackage } = await prepareCodemodePackages(home, agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "codemode-filter", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const limits = parseProcessWindowLimits(), prompts = [], declarations = [];
  const createHost = async (config, historyDir) => {
    const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, config.targetConnection.startTimeoutMs, limits), command: "" }) });
    const host = await createGatewayHost({ cwd: home, home, config, historyDir, model: "codemode-filter/controlled", targets: [executionTargetFromConfig({ id: "target", label: "target", local: true, python: target.python, cwd: target.root })] }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: channels,
        createKernel: (hooks) => createPythonTool({ target: "target", python: target.python, cwd: target.root, acquire: target.acquire, processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: false }, hooks) },
    });
    try { await prepareGatewayEnvironment(host, home, "target"); }
    catch (error) { await host.close(); throw error; }
    return { host, createWorker: async () => (await host.createSession({ target: "target", cwd: target.root })).session.sessionId };
  };
  const text = (result) => result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
  const run = async (code, isError, host, worker) => {
    provider.setResponses([(context) => {
      prompts.push(getCurrentSystemPrompt(context.messages));
      declarations.push(getCurrentTools(context.messages).map(({ name }) => name).sort());
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" });
    }, (context) => {
      prompts.push(getCurrentSystemPrompt(context.messages));
      declarations.push(getCurrentTools(context.messages).map(({ name }) => name).sort());
      return fauxAssistantMessage("Observed original package filter result.");
    }]);
    const admission = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: "Run the original real-package filter case." });
    assert.equal(admission.accepted, true);
    assert.equal((await admission.completion).status, "completed");
    const result = host.state(worker).messages.findLast(({ role, toolName }) => role === "toolResult" && toolName === "kernel_code");
    assert(result);
    assert.equal(result.isError, isError, text(result));
    return result;
  };
  await checkCodemodeFilters({ createHost, home, callbackPackage, otherPackage, run, prompts, text, onCleanup: (cleanup) => cleanups.push(cleanup) });
  for (const tools of declarations) assert.deepEqual(tools, ["kernel_code", "kernel_interrupt", "kernel_read"]);
  console.log("PASS original real-package deny-tools, allow-tools-deny-wins, deny-packages, allow-packages; PRK-owned kernel remains callable and third-party filters stay enforced");
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); }
