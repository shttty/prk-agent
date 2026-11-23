import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

export async function createSession(target, { tools = [], hooks = {}, options = {}, scoped = false } = {}) {
  const limits = parseProcessWindowLimits();
  const agentDir = join(target.home, randomUUID());
  await mkdir(agentDir);
  const owner = createPythonTool({ target: "owned", python: target.python, cwd: target.root, acquire: target.acquire,
    processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped }, { codeMode: true, ...hooks }, options);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: `kernel-${randomUUID()}`, models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const resourceLoader = new DefaultResourceLoader({ cwd: target.home, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd: target.home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager,
    sessionManager: SessionManager.inMemory(target.home), tools: [owner.tool.name, ...tools.map(({ name }) => name)], customTools: [owner.tool, ...tools] });
  const events = [];
  session.subscribe((event) => events.push(event));
  return {
    owner, session, events,
    async run(code, parameters = {}) {
      const id = randomUUID();
      provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code, ...parameters }, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Cell observed.")]);
      await session.prompt("Execute the owned kernel cell.");
      const result = session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
      if (!result) throw new Error("Real SDK emitted no kernel tool result.");
      return { result, text: result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n") };
    },
    async close() { await session.abort(); session.dispose(); await owner.close(); },
  };
}
