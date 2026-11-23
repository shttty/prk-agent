import assert from "node:assert/strict";
import { join } from "node:path";
import { ModelRuntime, SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";

export async function checkCompactionCancellation({ sdkHome, target, service }) {
const compactRuntime = await ModelRuntime.create({ authPath: join(sdkHome, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
const compactProvider = fauxProvider({ provider: "native-compaction-cancel", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
compactRuntime.registerNativeProvider(compactProvider.provider);
const compactModel = compactProvider.getModel("controlled");
if (!compactModel) throw new Error("The controlled compaction provider did not expose its model.");
const compactManager = SessionManager.inMemory(process.cwd());
compactManager.appendSessionInfo("native compaction cancellation");
compactManager.appendMessage({ role: "user", content: "compactable context ".repeat(128), timestamp: Date.now() });
compactManager.appendMessage(fauxAssistantMessage("previous controlled response"));
const compactSettings = SettingsManager.inMemory({ compaction: { enabled: true, reserveTokens: 1, keepRecentTokens: 1 }, retry: { enabled: false } });
const compactServices = await createAgentSessionServices({
  cwd: process.cwd(),
  agentDir: sdkHome,
  modelRuntime: compactRuntime,
  settingsManager: compactSettings,
  resourceLoaderOptions: {
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: "Controlled compaction cancellation contract session.",
  },
});
const { session: compactSession } = await createAgentSessionFromServices({
  services: compactServices,
  sessionManager: compactManager,
  model: compactModel,
  thinkingLevel: "off",
  tools: [],
  customTools: [],
});
const compactHost = createSessionHost({ session: compactSession });
const compactTarget = { ...target, sessionId: compactSession.sessionId, streamId: compactHost.getSnapshot().streamId, manager: compactManager, session: compactSession, host: compactHost };
const compactProviderEntered = Promise.withResolvers();
compactProvider.setResponses([async (_context, options) => {
  compactProviderEntered.resolve();
  const signal = options?.signal;
  if (!signal) throw new Error("The controlled compaction provider requires the SDK abort signal.");
  await new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", resolve, { once: true });
  });
  return fauxAssistantMessage("This summary must not be persisted after cancellation.");
}]);
try {
  const compactPromise = service.action(compactTarget, { sessionId: compactTarget.sessionId, requestId: "compact-original", action: "compact", args: {} });
  await compactProviderEntered.promise;
  const cancellation = await service.action(compactTarget, { sessionId: compactTarget.sessionId, requestId: "cancel-fresh", action: "cancel-native", args: { requestId: "compact-original" } });
  assert.equal(cancellation.status, "completed");
  assert.equal(cancellation.requestId, "cancel-fresh");
  assert.equal(cancellation.data.requestId, "compact-original");
  assert.equal(cancellation.data.outcomePending, true);
  const compactOutcome = await compactPromise;
  assert.equal(compactOutcome.status, "cancelled");
  assert.equal(compactOutcome.data.outcomeUnknown, true);
  assert.equal(compactManager.getEntries().some((entry) => entry.type === "compaction"), false);
  assert.equal(JSON.stringify(compactManager.buildSessionContext().messages).includes("This summary must not be persisted"), false);
} finally {
  await compactHost.close();
}
}
