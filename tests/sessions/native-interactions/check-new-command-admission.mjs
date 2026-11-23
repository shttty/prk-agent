import assert from "node:assert/strict";
import { SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SESSION_OPTIONS } from "../../../src/config/session/session-options.ts";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";
import { createNativeInteractionService } from "../../../src/sessions/native-interaction/assemble-native-interaction.ts";

export async function checkNewCommandAdmission({ home, modelRuntime, model }) {
  for (const extension of [false, true]) {
    const calls = [];
    const services = await createAgentSessionServices({ cwd: home, agentDir: home, modelRuntime,
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }), resourceLoaderOptions: {
        noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
        extensionFactories: extension ? [{ name: "new-override", factory: (pi) => pi.registerCommand("new", {
          description: "Controlled SDK new override", handler: async (args) => { calls.push(args); },
        }) }] : [],
      } });
    const { session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(home),
      model, thinkingLevel: "off", tools: [], customTools: [] });
    const host = createSessionHost({ session });
    const target = { sessionId: session.sessionId, streamId: host.getSnapshot().streamId,
      state: "idle", readOnly: false, target: "source-target", session, host, manager: session.sessionManager };
    let admissions = 0;
    const admit = async (deliver) => { admissions++; return deliver(target); };
    const service = createNativeInteractionService();
    try {
      assert.equal(service.catalog(target).commands.find(({ name }) => name === "new").source, extension ? "extension" : "builtin");
      const before = host.getSnapshot();
      for (const mode of [undefined, "auto"]) {
        const refused = await service.send(target, { sessionId: target.sessionId, requestId: `web-new-${extension}-${mode}`,
          message: "/new original argument", source: "web", ...(mode ? { mode } : {}),
          attachments: [{ name: "unread.txt", type: "text/plain", size: 1, data: "not-base64", source: "browser" }],
        }, admit);
        assert.equal(refused.accepted, false);
        assert.equal(refused.executed, false, "Web auto refuses /new before attachment decoding or command execution");
      }
      assert.equal(admissions, 0, "Web refusal never wakes or admits a source session");
      assert.deepEqual(host.getSnapshot().messages, before.messages);
      assert.deepEqual(calls, [], "The real SDK extension handler is not invoked by Web auto");

      const submitted = [];
      const plainTarget = { ...target, host: { ...host, submit: async (request) => {
        submitted.push(request);
        return { accepted: true, completion: Promise.resolve({ status: "completed" }) };
      } } };
      const original = "/new  original argument  ";
      for (const [plainService, mode] of [[service, "plain"], [createNativeInteractionService({ sessionOptions: { ...DEFAULT_SESSION_OPTIONS, defaultSendMode: "plain" } }), undefined]]) {
        const sent = await plainService.send(plainTarget, { sessionId: target.sessionId, requestId: `plain-new-${extension}-${mode}`,
          message: original, source: "web", ...(mode ? { mode } : {}) });
        assert.equal(sent.accepted, true);
        assert.equal(submitted.at(-1).message, original, "Explicit and configured plain modes retain the user's original /new text");
      }
      if (extension) {
        const sent = await service.send(target, { sessionId: target.sessionId, requestId: "sdk-new-override",
          message: "/new extension argument", mode: "auto" }, admit);
        assert.equal(sent.accepted, true);
        assert.equal((await sent.completion).status, "completed");
        assert.equal(admissions, 1);
        assert.deepEqual(calls, ["extension argument"], "Non-Web auto preserves the SDK's actual extension override");
        const busyTarget = { ...plainTarget, state: "running" };
        const queued = await service.send(busyTarget, { sessionId: target.sessionId, requestId: "busy-extension-new",
          message: "/new queued argument", mode: "auto", queue: "followUp" }, async (deliver) => deliver(busyTarget));
        assert.equal(queued.accepted, true, "An active non-Web extension keeps its SDK admission path while busy");
        assert.equal(submitted.at(-1).message, "/new queued argument");
        assert.equal(submitted.at(-1).queue, "followUp", "Extension command admission preserves the requested SDK queue");
      }
    } finally { await host.close(); }
  }
}