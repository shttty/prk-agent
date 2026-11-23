import { checkGatewaySettingsPersistence } from "./native-interactions/check-gateway-settings-persistence.mjs";
import { checkCompactionCancellation } from "./native-interactions/check-compaction-cancellation.mjs";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ModelRuntime,
  SessionManager,
  SettingsManager,
  createAgentSessionFromServices,
  createAgentSessionServices,
} from "@earendil-works/pi-coding-agent";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";
import { createNativeInteractionService } from "../../src/sessions/native-interaction/assemble-native-interaction.ts";
import { checkNewCommandAdmission } from "./native-interactions/check-new-command-admission.mjs";


const sdkHome = await mkdtemp(join(tmpdir(), "native-sdk-home-"));
const modelRuntime = await ModelRuntime.create({ authPath: join(sdkHome, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
const model = modelRuntime.getModels()[0];
if (!model) throw new Error("The installed Pi SDK did not expose a controlled model catalog.");
const manager = SessionManager.inMemory(process.cwd());
manager.appendSessionInfo("native contract session");
const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
const services = await createAgentSessionServices({
  cwd: process.cwd(),
  agentDir: sdkHome,
  modelRuntime,
  settingsManager,
  resourceLoaderOptions: {
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: "Controlled native interaction contract session.",
  },
});
const { session } = await createAgentSessionFromServices({
  services,
  sessionManager: manager,
  model,
  thinkingLevel: "off",
  tools: [],
  customTools: [],
});
const host = createSessionHost({ session });
const target = {
  sessionId: session.sessionId,
  streamId: host.getSnapshot().streamId,
  target: "remote",
  state: "idle",
  readOnly: false,
  session,
  host,
  manager,
  referenceCandidates: async () => ({ candidates: [{ type: "target-file", source: "session-target", target: "remote", sessionId: session.sessionId, path: "/folder/note.txt", name: "note.txt", label: "file" }], truncated: false }),
  readReference: async (path) => ({ path, type: "text/plain", content: "controlled target contents" }),
};
const targetless = { ...target, sessionId: `targetless-${session.sessionId}`, target: undefined, referenceCandidates: undefined, readReference: undefined };
const service = createNativeInteractionService();

const llamaSend = await service.send(target, { sessionId: target.sessionId, requestId: "disabled-llama", message: "/llama", mode: "auto" });
assert.equal(llamaSend.status, "unavailable");
assert.equal(llamaSend.data.executed, false);
assert.equal(service.catalog(targetless).references.targetFile.enabled, false);

const unknown = await service.send(target, { sessionId: target.sessionId, requestId: "unknown", message: "/unknown", mode: "auto" });
assert.equal(unknown.accepted, false);
assert.equal(unknown.plainSendAvailable, true);
assert.equal(unknown.executed, false);
const invalidArgs = await service.action(target, { sessionId: target.sessionId, requestId: "model-1", action: "model", args: { model: "missing/model" } });
assert.equal(invalidArgs.status, "failed");
const dequeued = await service.action(target, { sessionId: target.sessionId, requestId: "dequeue-1", action: "dequeue" });
assert.equal(dequeued.status, "completed");
assert.equal(dequeued.data.status, "not_found");
const busyTarget = { ...target, state: "running" };
const busy = await service.action(busyTarget, { sessionId: target.sessionId, requestId: "busy-1", action: "name", args: { name: "busy" } });
assert.equal(busy.status, "unavailable");
const archivedTarget = { ...target, session: undefined, host: undefined, readOnly: true };
const archivedExport = await service.action(archivedTarget, { sessionId: target.sessionId, requestId: "export-archived", action: "export", args: { format: "jsonl" } });
assert.equal(service.catalog(archivedTarget).commands.find((command) => command.name === "clone")?.availability.enabled, true, "Clone remains discoverable for read-only history");
assert.equal(archivedExport.status, "unavailable");
const references = await service.action(target, { sessionId: target.sessionId, requestId: "refs-1", action: "reference-candidates", args: { target: "remote", sessionId: session.sessionId, path: "" } });
assert.equal(references.status, "completed");
assert.equal(references.data.truncated, false);
const reference = await service.action(target, { sessionId: target.sessionId, requestId: "ref-1", action: "reference-read", args: { target: "remote", sessionId: session.sessionId, path: "/folder/note.txt" } });
assert.equal(reference.data.content, "controlled target contents");
const treeEntriesBeforeReads = manager.getEntries().length;
const treeLeafBeforeReads = manager.getLeafId();
for (const action of ["tree-read", "tree-filter", "tree-fold", "tree-copy", "copy"]) {
  const readResult = await service.action(target, { sessionId: target.sessionId, requestId: `read-${action}`, action, args: {} });
  assert.equal(readResult.status, "completed");
}
assert.equal(manager.getEntries().length, treeEntriesBeforeReads, "native read and presentation actions do not append SDK history");
assert.equal(manager.getLeafId(), treeLeafBeforeReads, "native read and presentation actions do not move the SDK leaf");
const structuredCommand = await service.send(target, { sessionId: target.sessionId, requestId: "structured-command", message: "/copy", mode: "auto", attachments: [{ name: "pixel.png", type: "image/png", size: 1, data: "AA==", source: "browser" }] });
assert.equal(structuredCommand.accepted, false);
let capturedSubmission;
const imageTarget = {
  ...target,
  host: {
    submit: async (submission) => {
      capturedSubmission = submission;
      return { accepted: true, requestId: submission.requestId, operationId: "image-operation", sessionId: session.sessionId, completion: Promise.resolve() };
    },
  },
};
const imageSend = await service.send(imageTarget, { sessionId: target.sessionId, requestId: "image-send", message: "inspect image", mode: "plain", attachments: [{ name: "pixel.png", type: "image/png", size: 1, data: "AA==", source: "browser" }] });
assert.equal(imageSend.accepted, true);
assert.deepEqual(capturedSubmission.images, [{ type: "image", data: "AA==", mimeType: "image/png" }]);
const activeCompletion = Promise.withResolvers();
const activeTarget = {
  ...target,
  host: {
    submit: async (submission) => ({ accepted: true, requestId: submission.requestId, operationId: "active-operation", sessionId: session.sessionId, completion: activeCompletion.promise }),
  },
};
const activeSend = await service.send(activeTarget, { sessionId: target.sessionId, requestId: "active-send", message: "active input", mode: "plain" });
assert.equal(activeSend.accepted, true);
const activeDuplicate = await service.send(activeTarget, { sessionId: target.sessionId, requestId: "active-send", message: "active input", mode: "plain" });
assert.equal(activeDuplicate.accepted, false);
assert.equal(activeDuplicate.active, true);
activeCompletion.resolve();
const closedSend = { ...target, host: undefined, readOnly: true };
await assert.rejects(
  service.send(closedSend, { sessionId: target.sessionId, requestId: "closed-ordinary", message: "ordinary", mode: "plain", attachments: [{ name: "broken", type: "text/plain", size: 1, data: "IQ==", source: "browser" }] }),
  (error) => error?.code === "NOT_FOUND",
);
let closedReferenceCalls = 0;
let closedSubmissions = 0;
const closedWithRuntime = {
  ...target,
  state: "closed",
  readOnly: true,
  host: {
    getSnapshot: () => ({ streamId: target.streamId, state: "closed" }),
    submit: async () => { closedSubmissions++; throw new Error("Closed input must not reach submission"); },
  },
  referenceCandidates: async () => { closedReferenceCalls++; return { candidates: [], truncated: false }; },
  readReference: async (path) => { closedReferenceCalls++; return { path, type: "text/plain", content: "retained target reference" }; },
};
assert.equal(service.catalog(closedWithRuntime).references.targetFile.enabled, false);
for (const action of ["reference-candidates", "reference-read"]) {
  await assert.rejects(service.action(closedWithRuntime, {
    sessionId: target.sessionId, requestId: `closed-${action}`, action,
    args: { target: target.target, sessionId: target.sessionId, path: "folder/note.txt" },
  }), (error) => error?.code === "READ_ONLY");
}
const referenceInput = {
  sessionId: target.sessionId, requestId: "closed-with-reference", message: "ordinary", mode: "plain",
  references: [{ type: "target-file", source: "session-target", target: target.target, sessionId: target.sessionId, path: "folder/note.txt" }],
};
const refusedClosedInput = await service.send(closedWithRuntime, referenceInput);
assert.equal(refusedClosedInput.accepted, false);
assert.equal(closedReferenceCalls, 0, "closed discovery, reads, and sends do not access retained target closures");
assert.equal(closedSubmissions, 0);
await checkCompactionCancellation({ sdkHome, target, service });
await checkGatewaySettingsPersistence();
await checkNewCommandAdmission({ home: sdkHome, modelRuntime, model });
const sensitive = await service.action(target, { sessionId: target.sessionId, requestId: "share-1", action: "share" });
assert.equal(sensitive.status, "unavailable");
await host.close();
await rm(sdkHome, { recursive: true, force: true });
console.log("native interaction contract checks passed");
