import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { withTargetFixture } from "../../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function checkGatewaySettingsPersistence() {
await withTargetFixture(async ({ config }) => {
const gatewayHistoryDirectory = await mkdtemp(join(tmpdir(), "native-gateway-history-"));
const gatewayModels = await ModelRuntime.create({ authPath: join(gatewayHistoryDirectory, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
const gatewayProvider = fauxProvider({ provider: "native-lifecycle-proof", models: [{ id: "primary", reasoning: true }, { id: "alternate", reasoning: true }], tokensPerSecond: 10000 });
gatewayModels.registerNativeProvider(gatewayProvider.provider);
gatewayProvider.setResponses(Array.from({ length: 20 }, () => fauxAssistantMessage("Controlled lifecycle reply.")));
const controlledModel = "native-lifecycle-proof/primary";
let gateway;
const startGatewayProof = () => createGatewayHost({ cwd: process.cwd(), home: gatewayHistoryDirectory, historyDir: gatewayHistoryDirectory, model: controlledModel, thinkingLevel: "off", targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture", cwd: process.cwd() })] }, { runtimeDependencies: { model: gatewayProvider.getModel("primary"), modelRuntime: gatewayModels, thinkingLevel: "off", cwd: process.cwd(), agentDir: gatewayHistoryDirectory } });
try {
  gateway = await startGatewayProof();
  await prepareGatewayEnvironment(gateway, gatewayHistoryDirectory, "fixture");
  const createdWorker = await gateway.createSession({ target: "fixture", label: "real lifecycle" });
  const gatewayName = createdWorker.session.sessionId;
  const suffix = await gateway.nativeAction(gatewayName, { sessionId: gatewayName, requestId: "real-suffix", action: "name", args: { name: "post-resume suffix" } });
  assert.equal(suffix.status, "completed");
  const changedThinking = await gateway.nativeAction(gatewayName, { sessionId: gatewayName, requestId: "real-thinking", action: "thinking", args: { level: "low" } });
  assert.equal(changedThinking.status, "completed");
  const changedModel = await gateway.nativeAction(gatewayName, { sessionId: gatewayName, requestId: "real-model", action: "model", args: { model: "native-lifecycle-proof/alternate" } });
  assert.equal(changedModel.status, "completed");
  const suffixMessage = await gateway.session(gatewayName).submit({ requestId: "post-resume-message", message: "POST_RESUME_MESSAGE" });
  assert.equal((await suffixMessage.completion).status, "completed");
  await gateway.close();
  gateway = await startGatewayProof();
  const resumedHistory = gateway.history(gatewayName).session;
  assert.equal(resumedHistory.sessionId, createdWorker.session.sessionId);
  assert.equal(resumedHistory.label, "post-resume suffix");
  assert.equal(gateway.history(gatewayName).snapshot.model, "native-lifecycle-proof/alternate");
  assert.equal(gateway.history(gatewayName).snapshot.thinkingLevel, "low");
  assert.ok(gateway.history(gatewayName).snapshot.messages.some((message) => JSON.stringify(message.content).includes("POST_RESUME_MESSAGE")), "actual post-resume model conversation survives restart");
} finally {
  await gateway?.close().catch(() => { });
  await rm(gatewayHistoryDirectory, { recursive: true, force: true });
}
});
}
