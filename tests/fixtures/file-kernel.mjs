// Contract runners use the real SDK nested-tool path, never a fabricated executeTool context.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { createTargetFileTools } from "../../src/sessions/target-files/create-tools.ts";
import { KERNEL_READ_NOTICE } from "../../src/sessions/target-files/file-protocol.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../src/config/target-connection/target-connection-options.ts";

export async function createFileKernel(config, hooks, home, onCleanup) {
  const agentDir = join(home, `file-agent-${randomUUID()}`);
  await mkdir(agentDir, { recursive: true });
  const owner = createPythonTool(config, { ...hooks, fileReadNotice: KERNEL_READ_NOTICE });
  let lease;
  const channels = createTargetChannels({
    options: { ...DEFAULT_TARGET_CONNECTION_OPTIONS, processWindow: config.processWindow },
    open: async (_machine, signal, limits) => ({ transport: await openProcessTransport(await config.acquire(), config.python, config.cwd, signal, DEFAULT_TARGET_CONNECTION_OPTIONS.startTimeoutMs, limits), command: "" }),
  });
  const files = createTargetFileTools(() => lease ??= channels.acquire("fixture"), config.cwd);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: `file-contract-${randomUUID()}`, models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const resourceLoader = new DefaultResourceLoader({ cwd: config.cwd, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd: config.cwd, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: SessionManager.inMemory(config.cwd), tools: [owner.tool.name, ...files.map(({ name }) => name)], customTools: [owner.tool, ...files] });
  onCleanup(async () => { await session.abort(); session.dispose(); await owner.close(); await lease?.release(); });
  return {
    owner,
    async execute(_id, args, signal, update) {
      const id = randomUUID();
      provider.setResponses([fauxAssistantMessage(fauxToolCall(owner.tool.name, args, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Contract cell observed.")]);
      const unsubscribe = session.subscribe((event) => { if (event.type === "tool_execution_update" && event.toolCallId === id) update?.(event.partialResult); });
      const abort = () => { void session.abort(); };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        await session.prompt("Execute the contract cell.");
        const result = session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
        if (!result) throw new Error("SDK emitted no kernel result for contract cell");
        return result;
      } finally { unsubscribe(); signal?.removeEventListener("abort", abort); }
    },
  };
}
