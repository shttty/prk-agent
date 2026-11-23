import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { parseDerivationConfig } from "../../src/config/derivation/parse-config.ts";
import { selectDerivationModel } from "../../src/config/derivation/select-model.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { checkBatchResults } from "./derivation/check-batch-results.mjs";
import { checkDerivedLifecycle } from "./derivation/check-lifecycle.mjs";
import { checkDerivedBrowser } from "./derivation/check-browser.mjs";
import { waitForSessionCondition } from "./derivation/wait-for-session-condition.mjs";
import { callSessionTool } from "./derivation/call-session-tool.mjs";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-derived-sessions-"));
  const workerCwd = join(root, "worker-cwd");
  const sessionCwd = join(root, "session-cwd");
  await Promise.all([mkdir(workerCwd), mkdir(sessionCwd)]);
  let host, gateway, client;
  onCleanup(async () => {
    await client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "derivation-check", models: [{ id: "root" }, { id: "temporary" }, { id: "review" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(faux.provider);
  const seenContexts = [];
  const nativeNames = ["read", "bash", "edit", "write", "grep", "find", "ls"];
  faux.setResponses(Array.from({ length: 300 }, () => async (context) => {
    seenContexts.push(context);
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("Tool completed; awaiting explicit instructions.");
    const command = /^TOOL (\{.*\})$/s.exec(text(last));
    if (command) {
      const { tool, args } = JSON.parse(command[1]);
      return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Task admitted. No implicit completion or acknowledgment.");
  }));
  const derivation = parseDerivationConfig({
    sessions: [], derivation: {
    roles: { task: { model: "derivation-check/temporary", thinkingLevel: "off" },
      reviewer: { model: "derivation-check/review", thinkingLevel: "off", instructions: "ROLE_REVIEW_MARKER" }, batchDirect: { toolMode: "direct" }, batchCode: { toolMode: "code" } },
    }
  });
  assert.throws(() => parseDerivationConfig({ derivation: { typo: true } }));
  assert.throws(() => selectDerivationModel(derivation, { lifecycle: "temporary", role: "missing" }, { model: faux.getModel("root"), thinkingLevel: "off" }, modelRuntime));
  const options = {
    cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct", localTools: true } }), model: "derivation-check/root", derivation, targets: [
    executionTargetFromConfig({ ...config, id: "local", label: "Local instance", local: true, cwd: workerCwd }),
    executionTargetFromConfig({ ...config, id: "alternate", label: "Alternate local instance", local: true, cwd: root }),
    ]
  };
  const dependencies = { runtimeDependencies: { model: faux.getModel("root"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } };
  host = await createGatewayHost(options, dependencies);
  gateway = await startGateway(host, join(root, "gateway.sock"));
  client = await connectGateway(join(root, "gateway.sock"));
  const all = () => host.workbench().sessions;
  const get = (name) => all().find((worker) => worker.sessionId === name || worker.sessionId === name);
  const idle = async (name) => waitForSessionCondition(() => !get(name) || !host.session(get(name).sessionId).getSnapshot().operation, `idle ${name}`);
  let counter = 0;
  const call = (name, tool, args, expectedError) => callSessionTool({ host, client, nativeNames, text, idle, directory: join(root, options.config.session.historyDir) }, name, tool, args, expectedError, `check-${++counter}`);
  const a = (await host.createSession({ target: "local", label: "Parent coordinator" })).session.sessionId;
  const outsider = (await host.createSession({ target: "local", label: "Receiver coordinator" })).session.sessionId;
  const mainConversation = await host.session(a).submit({ requestId: "main-context", message: "MAIN_CONTEXT_MARKER — coordinate an explicit worker." });
  assert(mainConversation.accepted);
  assert.equal((await mainConversation.completion).status, "completed");
  const discovery = await call(a, "space_status", {});
  assert(discovery.targets.every((target) => !Object.hasOwn(target, "sshCommand")), "Discovery does not publish connection commands");
  const selectedTarget = await call(a, "space_status", { target: "local" });
  assert.equal(selectedTarget.targets.find((target) => target.id === "local").python, config.python, "Read-only discovery exposes the instance interpreter");
  await checkBatchResults({ host, call, idle, get, owner: a, seenContexts, text });
  await checkDerivedLifecycle({ host, client, call, idle, get, all, a, outsider, workerCwd, sessionCwd, root, seenContexts, nativeNames, text });
  await checkDerivedBrowser({ host, call, idle, get, until: waitForSessionCondition, a, root, onCleanup });
  const retained = (await call(a, "session_spawn", { context: "Retain the validated structured result across a Gateway restart.", tasks: [{ task: "Retain across restart", label: "Retain across restart", lifecycle: "persistent", target: "local", outputSchema: { type: "object", properties: { retained: { const: true } }, required: ["retained"], additionalProperties: false } }] })).children[0].sessionId;
  await idle(retained);
  await call(retained, "session_result", { summary: "Durable waiting result", output: { retained: true } });
  const retainedFinishedAt = get(retained).derivation.result.finishedAt;
  await idle(a);
  assert(host.history(a).snapshot.messages.some((message) => text(message).includes("Review result")), "Transferred result remains readable after child destruction");
  // Cascade: archiving a session also archives the children it owns (deepest first); all form one archive group.
  const cascadeParent = (await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Cascade parent", label: "Cascade parent", lifecycle: "persistent", target: "local" }] })).children[0].sessionId;
  await idle(cascadeParent);
  const cascadeChild = (await call(cascadeParent, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Cascade child", label: "Cascade child" }] })).children[0].sessionId;
  await idle(cascadeChild);
  const keptChild = (await call(cascadeParent, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Upgraded child", label: "Upgraded child", lifecycle: "persistent" }] })).children[0].sessionId;
  await idle(keptChild);
  const cascadeRoute = cascadeParent, cascadeChildRoute = cascadeChild;
  await host.manageSession(keptChild, { action: "upgrade" });
  const preview = host.archivePreview(cascadeParent);
  assert.deepEqual(preview.sessions.map((session) => session.sessionId), [cascadeChildRoute, cascadeRoute], "Preview lists owned children deepest first");
  assert.deepEqual(preview.retained.map((session) => session.sessionId), [keptChild], "Upgraded children are shown as retained");
  assert((await call(a, "session_list", {})).some((peer) => peer.sessionId === cascadeChild), "Live children are reachable peers");
  await host.assignProject(cascadeParent, { id: "project-archive", name: "归档验收项目" });
  await call(a, "session_manage", { action: "destroy", child: cascadeParent });
  assert(!get(cascadeParent) && !get(cascadeChild), "Cascade hides the parent and its owned child");
  assert.equal(get(keptChild)?.derivation.lifecycle, "user", "Upgraded child survives its creator's destruction");
  const cascadeGroup = host.workbench().archive.find((entry) => entry.group === cascadeRoute);
  assert.deepEqual(cascadeGroup.sessions.map((session) => session.sessionId).sort(), [cascadeChild, cascadeParent].sort(), "One archiving is one archive group");
  const archivedRoot = cascadeGroup.sessions.find((session) => session.sessionId === cascadeParent);
  const archivedChild = cascadeGroup.sessions.find((session) => session.sessionId === cascadeChild);
  assert.deepEqual([archivedRoot.owner, archivedRoot.target, archivedRoot.projectId, archivedRoot.projectName], [a, "local", "project-archive", "归档验收项目"],
    "The archive lists where the root sat: its owner outside the group, instance and project");
  assert.deepEqual([archivedChild.owner, archivedChild.target], [cascadeParent, "local"], "Children keep their owner and target inside the group");
  assert(!(await call(a, "session_list", {})).some((peer) => peer.sessionId === cascadeParent || peer.sessionId === cascadeChild), "Archived sessions are not reachable peers");
  await call(a, "session_send", { to: archivedChild.sessionId, message: "hello?" }, true);
  assert.equal(get(cascadeChild), undefined, "Rejected peer delivery does not revive an archived session");
  assert.deepEqual(host.workbench().archive.find((entry) => entry.group === cascadeRoute), cascadeGroup, "Rejected peer delivery preserves the archived subtree");
  assert.throws(() => host.history(cascadeChild), "Archived sessions are not readable as live history");
  // A child archived on its own whose owner is archived later: unarchived alone it comes back independent.
  const orphanParent = (await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Orphan parent", label: "Orphan parent", lifecycle: "persistent", target: "local" }] })).children[0].sessionId;
  await idle(orphanParent);
  const orphan = (await call(orphanParent, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Orphan child", label: "Orphan child", lifecycle: "persistent" }] })).children[0].sessionId;
  await idle(orphan);
  await host.archiveSession(orphan, { confirm: true });
  await host.archiveSession(orphanParent, { confirm: true });
  const callsBeforeRestart = seenContexts.length;
  await client.disconnect(); client = undefined;
  await gateway.close(); gateway = undefined;
  options.config = parsePrkConfig({ session: { workerTools: "direct" } });
  host = await createGatewayHost(options, dependencies);
  assert.equal(get(retained).derivation.result.summary, "Durable waiting result");
  assert.deepEqual(get(retained).derivation.result.output, { retained: true }, "Validated structured output survives Gateway reconstruction");
  assert.equal(get(retained).derivation.result.startedAt, get(retained).derivation.startedAt, "Persisted result retains the original task start");
  assert.equal(get(retained).derivation.result.finishedAt, retainedFinishedAt, "Persisted result retains its one successful submission finish");
  assert.equal(seenContexts.length, callsBeforeRestart, "Restart does not replay model work");
  assert(host.workbench().archive.some((entry) => entry.group === cascadeRoute), "The archive survives a Gateway restart");
  await host.unarchive(orphan);
  assert.equal(get(orphan).derivation, undefined, "An owner that is still archived is not waited for: the child comes back independent");
  await host.unarchive(orphanParent);
  assert.equal(get(orphanParent).derivation?.owner, a, "Unarchiving later keeps the parent's own listed owner");
  assert.equal(get(orphan).derivation, undefined, "Independence is not undone by the owner's return");
  await host.unarchive(cascadeParent);
  assert.equal(get(cascadeParent).derivation?.owner, a, "Unarchive keeps an owner that is still listed");
  assert.equal(get(cascadeChild).derivation.owner, cascadeParent, "Links inside the unarchived group remain");
  assert.equal(get(cascadeParent).state, "closed", "Unarchive allocates no runtime");
  assert.equal(get(cascadeChild).sessionId, archivedChild.sessionId, "Unarchive brings back the same SDK session");
  const resumed = await host.nativeSend(cascadeChild, { sessionId: cascadeChild, requestId: "unarchived-continue", message: "plain message after unarchive", mode: "plain" });
  assert.equal(resumed.accepted, true, "A message to an unarchived worker starts a runtime by the existing rule");
  assert.equal((await resumed.completion).status, "completed");
  assert.notEqual(get(cascadeChild).state, "closed");
  assert.equal(get(cascadeChild).derivation.owner, cascadeParent, "Continuing keeps ownership");
  await host.archiveSession(cascadeParent, { confirm: true });
  assert(!get(cascadeParent) && !get(cascadeChild), "Web archiving uses the same cascade");
  await assert.rejects(host.purgeArchive(cascadeParent, {}), /confirmation/);
  await host.purgeArchive(cascadeParent, { confirm: true });
  assert(!host.workbench().archive.some((entry) => entry.group === cascadeRoute), "Purged group leaves the archive");
  assert.throws(() => host.history(cascadeChildRoute), /not managed/, "Purge deletes the SDK files");
  // An independent worker archived from the web comes back continuable with its execution binding.
  const archivedWorker = (await host.createSession({ target: "local", label: "Archived coordinator" })).session.sessionId;
  await host.archiveSession(archivedWorker, { confirm: true });
  assert(!get(archivedWorker), "Archiving hides an independent worker");
  await host.unarchive(archivedWorker);
  assert.equal(get(archivedWorker).state, "closed", "Unarchive allocates no runtime");
  const resumedCoordinator = await host.nativeSend(archivedWorker, { sessionId: archivedWorker, requestId: "unarchived-coordinator", message: "plain message to unarchived worker", mode: "plain" });
  assert.equal(resumedCoordinator.accepted, true, "New input starts the unarchived worker");
  assert.equal((await resumedCoordinator.completion).status, "completed");
  await host.manageSession(retained, { action: "upgrade" });
  await host.archiveSession(retained, { confirm: true });
  assert(!get(retained));
  const beforeBadTarget = all().map(({ name }) => name).sort();
  await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Unknown explicit target", label: "Unknown explicit target", target: "not-configured" }] }, /target|configured/i);
  assert.deepEqual(all().map(({ name }) => name).sort(), beforeBadTarget, "Unknown targets create no child and never guess another instance");
  const override = (await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Explicit target overrides inheritance", label: "Explicit target override", target: "alternate" }] })).children[0].sessionId;
  await idle(override);
  assert.equal(get(override).target, "alternate");
  await call(override, "kernel_code", { code: "print('python-mode-proof')" });
  const directTools = new Set(getCurrentTools(seenContexts.at(-1).messages).map((tool) => tool.name));
  assert(directTools.has("kernel_code") && directTools.has("session_spawn") && directTools.has("session_send") && directTools.has("session_result"));
  for (const name of nativeNames) assert(!directTools.has(name), `Worker direct mode excludes ${name}`);
  assert(directTools.has("ask"), "Worker direct mode offers ask too");
  await call(a, "session_manage", { action: "destroy", child: override });
  await host.close();
  options.derivation = derivation;
  host = await createGatewayHost(options, dependencies);
  const inheritedAfterRestart = (await call(a, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Inherit target after Gateway restart", label: "Restart target inheritance" }] })).children[0].sessionId;
  await idle(inheritedAfterRestart);
  assert.equal(get(inheritedAfterRestart).target, "local");
  await call(a, "session_manage", { action: "destroy", child: inheritedAfterRestart });
  console.log("PASS controlled-provider real SDK worker tools + inherited/explicit cross-instance selection + nested sessions + independent Jupyter variables/shared files + roles + receipt-delivered results + transfer/upgrade/fixed control + archive/unarchive/purge + durable history restart without replay; no external-model autonomy claim");
}, { alternateKernelSpec: true });
