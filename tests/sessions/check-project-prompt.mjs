import assert from "node:assert/strict";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, getCurrentSystemMessage } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { checkRename } from "./project-prompt/check-rename.mjs";

await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const { agentDir } = initializePrkHome(tempRoot);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "project-prompt", models: [{ id: "controlled" }] });
  modelRuntime.registerNativeProvider(provider.provider);
  const host = await createGatewayHost({ cwd: tempRoot, home: tempRoot, model: "project-prompt/controlled",
    config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false } }),
    targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture" })],
  }, { runtimeDependencies: { cwd: tempRoot, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off", noSkills: true } });
  onCleanup(() => host.close());
  await prepareGatewayEnvironment(host, tempRoot, "fixture");
  const create = async (project) => (await host.createSession({ target: "fixture", ...(project ? { project } : {}) })).session.sessionId;
  let serial = 0;
  async function projectSection(sessionId) {
    let section;
    provider.setResponses([(context) => {
      section = getCurrentSystemMessage(context.messages)?.sections?.project;
      return fauxAssistantMessage("OK");
    }]);
    const turn = await host.nativeSend(sessionId, { sessionId, requestId: `project-${++serial}`, message: "OK", mode: "plain" });
    assert.equal(turn.accepted, true);
    assert.equal((await turn.completion).status, "completed");
    return section;
  }
  assert.equal(await projectSection(await create({ name: "资产盘点" })), "<project>\n当前项目：资产盘点\n</project>");
  assert.equal(await projectSection(await create()), undefined);

  const sessionId = await create({ name: "Before" });
  const before = host.state(sessionId);
  assert.equal(before.requiresReload, false);
  const events = [];
  const unsubscribe = host.subscribeSessions((event) => events.push(event));
  onCleanup(unsubscribe);
  host.assignProject(sessionId, { id: "project-next", name: "After" });
  assert.equal(events.findLast((event) => event.type === "session_project_assigned")?.details?.session?.requiresReload, true);
  const pending = host.state(sessionId);
  assert.equal(pending.requiresReload, true);
  assert.equal(pending.streamId, before.streamId);
  assert.match(await projectSection(sessionId), /当前项目：Before/u);
  const reload = await host.nativeAction(sessionId, { sessionId, requestId: "reload-project", action: "reload", args: {} });
  assert.equal(reload.status, "completed");
  assert.equal(host.state(sessionId).requiresReload, false);
  assert.match(await projectSection(sessionId), /当前项目：After/u);
  await checkRename({ host, home: tempRoot, create, projectSection, events });
});
console.log("project startup prompt checks passed");
