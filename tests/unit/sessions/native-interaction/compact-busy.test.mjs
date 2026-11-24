import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { ModelRuntime, SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { createSessionHost } from "../../../../src/sessions/host/assemble-host.ts";
import { createNativeInteractionService } from "../../../../src/sessions/native-interaction/assemble-native-interaction.ts";
import { commandAvailability } from "../../../../src/sessions/native-interaction/catalog/command-availability.ts";
import { staticCommands } from "../../../../src/sessions/native-interaction/catalog/command-metadata.ts";

const compactCmd = staticCommands.find((entry) => entry.name === "compact");

test("compact requires waking a sleeping target and still interrupts running targets", () => {
  for (const [state, readOnly] of [["idle", false], ["running", false], ["closed", true], ["unavailable", true]]) {
    assert.deepEqual(commandAvailability(compactCmd, { sessionId: "s1", streamId: "st", state, readOnly, manager: {} }), { enabled: true });
  }
  assert.equal(commandAvailability(compactCmd, { sessionId: "s1", streamId: "st", state: "closing", readOnly: true, manager: {} }).enabled, false);
  assert.equal(commandAvailability(compactCmd, { sessionId: "s1", streamId: "st", state: "sleeping", readOnly: false, manager: {} }).enabled, false);
});

test("compact interrupts a running SessionHost turn cleanly and compacts real session context", async () => {
  const sdkHome = await mkdtemp(join(tmpdir(), "compact-busy-unit-"));
  let host;
  try {
    const modelRuntime = await ModelRuntime.create({ authPath: join(sdkHome, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "unit-compact-busy", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const model = provider.getModel("controlled");
    const manager = SessionManager.inMemory(sdkHome);
    manager.appendSessionInfo("busy compact unit");
    manager.appendMessage({ role: "user", content: "compactable context ".repeat(128), timestamp: Date.now() });
    manager.appendMessage(fauxAssistantMessage("prior assistant reply"));
    const settings = SettingsManager.inMemory({ compaction: { enabled: true, reserveTokens: 1, keepRecentTokens: 1 }, retry: { enabled: false } });
    const services = await createAgentSessionServices({
      cwd: sdkHome,
      agentDir: sdkHome,
      modelRuntime,
      settingsManager: settings,
      resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, systemPrompt: "Test." },
    });
    const { session } = await createAgentSessionFromServices({ services, sessionManager: manager, model, thinkingLevel: "off", tools: [], customTools: [] });
    host = createSessionHost({ session });
    const turnEntered = Promise.withResolvers();
    provider.setResponses([
      async (_ctx, options) => {
        turnEntered.resolve();
        const signal = options?.signal;
        await new Promise((resolve) => {
          if (signal?.aborted) resolve();
          else signal?.addEventListener("abort", resolve, { once: true });
        });
        return fauxAssistantMessage("interrupted reply");
      },
      fauxAssistantMessage("compacted summary text"),
    ]);
    const submission = await host.submit({ requestId: "req-turn", message: "start long turn" });
    assert.equal(submission.accepted, true);
    await turnEntered.promise;
    const target = { sessionId: session.sessionId, streamId: host.getSnapshot().streamId, state: "running", readOnly: false, manager, session, host };
    const service = createNativeInteractionService();
    const compacted = Promise.withResolvers();
    const subscription = host.subscribe((event) => {
      if (event.type === "operation_completed" && event.details.kind === "compact") compacted.resolve(event);
    });
    const admission = await service.action(target, { sessionId: session.sessionId, requestId: "req-compact", action: "compact", args: { instructions: "keep facts" } });
    assert.equal(admission.status, "running");
    const interrupted = await submission.completion;
    assert.equal(interrupted.status, "cancelled");
    const completion = await compacted.promise;
    subscription.unsubscribe();
    assert.equal(completion.operationId, admission.data.operationId);
    assert.equal(completion.details.status, "completed");
    assert.equal(manager.getEntries().some((entry) => entry.type === "compaction"), true);
  } finally {
    if (host) await host.close();
    await rm(sdkHome, { recursive: true, force: true });
  }
});
