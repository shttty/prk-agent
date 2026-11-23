import { parse, stringify } from "smol-toml";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-instance-reload-"));
  const configPath = join(root, "config.toml");
  const instancesPath = join(root, "instances.toml");
  let host, gateway, client, adapter, web;
  onCleanup(async () => {
    try {
      await web?.close();
      await adapter?.close();
      client?.disconnect();
      if (gateway) await gateway.close(); else await host?.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  const first = { id: "local", label: "Local instance", tags: [], sshCommand: "exec /bin/sh", python: config.python, cwd: root };
  const second = { id: "office", label: "Other instance", tags: [], sshCommand: "exec /bin/sh", python: config.python, cwd: root };
  const globalDocument = { session: { workerTools: "direct" } };
  const globalBytes = stringify(globalDocument);
  await writeFile(configPath, globalBytes);
  const save = (instances) => writeFile(instancesPath, stringify({ instances }), { mode: 0o600 });
  await save([first]);
  await chmod(instancesPath, 0o600);

  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "reload-controlled", models: [{ id: "local" }], tokensPerSecond: 5000 });
  runtime.registerNativeProvider(provider.provider);
  let modelCalls = 0;
  provider.setResponses(Array.from({ length: 12 }, () => async (context) => {
    modelCalls++;
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Done");
    const last = context.messages.filter((m) => m.role === "user").at(-1);
    const text = typeof last.content === "string" ? last.content : last.content.map((c) => c.text ?? "").join("");
    return fauxAssistantMessage(fauxToolCall("kernel_code", { code: text }), { stopReason: "toolUse" });
  }));
  host = await createGatewayHost({ cwd: root, home: root, config: parsePrkConfig(globalDocument, { instances: [first] }), model: "reload-controlled/local" }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "low", cwd: root, agentDir: root },
  });
  const socket = join(root, "gateway.sock");
  gateway = await startGateway(host, socket);
  client = await connectGateway(socket);
  adapter = await connectWebGateway({ socket });
  web = await startWebServer(adapter, { port: 0 });
  const execute = async (name, code, id) => {
    const accepted = await host.session(name).submit({ requestId: id, message: code });
    let timer;
    try {
      const completion = await Promise.race([accepted.completion, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Controlled Python operation timed out")), 30_000);
      })]);
      assert.equal(completion.status, "completed");
      const state = host.session(name).getSnapshot();
      const result = state.messages.filter((m) => m.role === "toolResult").at(-1);
      assert.equal(result.details.outcome, "ok", JSON.stringify(result.content));
      return state;
    } finally { clearTimeout(timer); }
  };

  const live = await host.createSession({ target: "local" });
  const before = await execute(live.session.sessionId, "reload_value = 41\nprint(reload_value)", "seed");
  const callsBeforeReload = modelCalls;

  await save([first, second]);
  const reloaded = await client.request("reloadTargets", {});
  assert.deepEqual(reloaded.targets.map(({ id, label }) => ({ id, label })), [
    { id: "local", label: "Local instance" },
    { id: "office", label: "Other instance" },
  ]);
  assert.equal(modelCalls, callsBeforeReload, "Reload must not invoke a model");
  const preserved = host.session(live.session.sessionId).getSnapshot();
  assert.equal(preserved.sessionId, before.sessionId);
  assert.equal(preserved.kernel.kernelId, before.kernel.kernelId);
  assert.equal(host.workbench().sessions.find((worker) => worker.sessionId === live.session.sessionId).cwd, first.cwd);
  const after = await execute(live.session.sessionId, "assert reload_value == 41\nprint(reload_value)", "read-after-reload");
  assert.equal(after.kernel.kernelId, before.kernel.kernelId, "Existing Python state survives instance addition");

  assert.equal(reloaded.targets.find(({ id }) => id === "local").local, false, "Omitted locality defaults to false");
  await save([{ ...first, local: true, sshCommand: undefined }, second]);
  await assert.rejects(client.request("reloadTargets", {}), (error) => error.code === "BUSY", "Reload cannot change locality while a worker is bound");
  await assert.rejects(client.request("editTarget", { target: { ...first, local: true, sshCommand: "" } }), (error) => error.code === "BUSY", "Editing cannot change locality while a worker is bound");
  assert.deepEqual(host.workbench().targets, reloaded.targets, "Rejected locality changes retain the old public marker and accepted instances");

  const postReload = (body = {}, origin = web.url) => fetch(`${web.url}/api/targets/reload`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
  });
  assert.equal((await postReload({}, "http://evil.invalid")).status, 403);
  assert.equal((await postReload({ unexpected: true })).status, 400);
  await writeFile(instancesPath, "[[instances]");
  assert.notEqual((await postReload()).status, 200);
  assert.deepEqual(host.workbench().targets, reloaded.targets, "Invalid TOML leaves accepted instances unchanged");

  await save([{ ...first, cwd: tmpdir() }, second]);
  await client.request("reloadTargets", {});
  assert.equal(host.workbench().sessions.find((worker) => worker.sessionId === live.session.sessionId).cwd, first.cwd);
  await execute(live.session.sessionId, `import os\nassert os.getcwd() == ${JSON.stringify(first.cwd)}\nassert reload_value == 41`, "preserved-session-directory");
  await save([second]);
  await assert.rejects(client.request("reloadTargets", {}), (error) => error.code === "BUSY");
  assert.deepEqual(host.workbench().targets, reloaded.targets, "Rejected active removal is atomic");

  await host.closeSession(live.session.sessionId);
  await save([{ ...first, id: " local ", local: true, sshCommand: undefined }]); // hand-padded ID: parsing trims it; edit/delete must still match
  const response = await postReload();
  assert.equal(response.status, 200);
  const afterClose = await response.json();
  assert.deepEqual(afterClose.targets.map(({ id }) => id), ["local"]);
  assert.equal(afterClose.targets[0].local, true, "Closing the bound worker permits a locality change");
  await assert.rejects(host.createSession({ target: "office" }), (error) => error.code === "NOT_FOUND");
  const cli = await promisify(execFile)(process.execPath, ["src/main.ts", "attach", "reload-targets", "--home", root, "--socket", socket], {
    cwd: new URL("../../", import.meta.url), timeout: 15_000,
  });
  assert.deepEqual(JSON.parse(cli.stdout).targets.map(({ id }) => id), ["local"]);

  const mutation = (path, method, body, origin = web.url) => fetch(`${web.url}${path}`, {
    method, headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
  });
  const rejectedSecret = "invalid-token-value-must-not-be-echoed\n";
  const rejected = await mutation("/api/targets", "POST", { target: { ...second, token: rejectedSecret } });
  assert.equal(rejected.status, 400);
  assert(!(await rejected.text()).includes(rejectedSecret.trim()), "Invalid token values must not appear in error responses");

  const shared = { ...second, id: "local-other", label: "Local other" };
  const added = await mutation("/api/targets", "POST", { target: shared });
  assert(added.status >= 200 && added.status < 300);
  const addedBody = await added.json();
  assert.deepEqual(addedBody.targets.map(({ id }) => id), ["local", "local-other"]);
  for (const target of addedBody.targets) assert.deepEqual(Object.keys(target).sort(), ["id", "label", "local", "python", "tags"]);
  assert(!JSON.stringify(addedBody).includes(shared.sshCommand), "Workbench does not publish connection commands");
  const addedInstances = structuredClone(parse(await readFile(instancesPath, "utf8"))).instances;
  assert.deepEqual(addedInstances.map(({ id }) => id), [" local ", "local-other"], "Adding an instance preserves untouched raw identities while runtime routing remains normalized");
  assert.equal(addedInstances[1].sshCommand, shared.sshCommand);
  assert.equal(addedInstances[1].python, shared.python);
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Adding an instance never writes global settings");
  const editable = await client.request("getTarget", { target: shared.id });
  assert.equal(editable.sshCommand, addedInstances[1].sshCommand, "Editable API retains the original connection command");
  assert.equal(editable.python, addedInstances[1].python, "Editable API retains the instance interpreter");
  const bytesBeforeDuplicate = await readFile(instancesPath, "utf8");
  assert((await mutation("/api/targets", "POST", { target: shared })).status >= 400);
  assert.equal(await readFile(instancesPath, "utf8"), bytesBeforeDuplicate, "Duplicate instance creation never suffixes or partially writes");
  const edited = await mutation("/api/targets/local", "PATCH", { target: { label: "工作实例" } });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).targets[0].label, "工作实例");
  const persistedEdit = structuredClone(parse(await readFile(instancesPath, "utf8")));
  assert.equal(persistedEdit.instances[0].label, "工作实例");
  assert.equal(persistedEdit.instances[0].local, true, "Omitting locality during an edit retains the explicit marker");
  assert.equal(persistedEdit.instances[0].python, first.python, "Omitted Python edit retains the interpreter");
  assert.equal(persistedEdit.instances[0].sshCommand, undefined, "A local instance has no remote command");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Editing an instance never writes global settings");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600, "Instances are restricted to their owner after replacement");
  await client.request("capabilitiesChange", { instance: "local", changes: [{ id: "kernel:bash", enabled: null }] });
  assert.deepEqual(structuredClone(parse(await readFile(instancesPath, "utf8"))).instances[0].capabilities, {}, "Instance capability changes save in instances.toml");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Instance capability changes leave global settings untouched");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600, "Instance capability saves retain mode 0600");

  assert.equal((await mutation("/api/targets/local-other", "DELETE", { confirm: false })).status, 400);
  const deleted = await mutation("/api/targets/local-other", "DELETE", { confirm: true });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await deleted.json()).targets.map(({ id }) => id), ["local"]);
  assert.equal((await readFile(instancesPath, "utf8")).includes("local-other"), false);
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Deleting an instance never writes global settings");
  await client.request("addTarget", { target: second });
  await client.request("deleteTarget", { target: "office", confirm: true });
  assert.equal(structuredClone(parse(await readFile(instancesPath, "utf8"))).instances.some(({ id }) => id === "office"), false, "Wire deletion removes the complete instance");
  const reopened = await createGatewayHost({ cwd: root, home: root, model: "offline/unavailable" });
  try {
    assert.deepEqual(reopened.workbench().targets, [{ id: "local", label: "工作实例", local: true, python: config.python, tags: [] }]);
    assert.equal(host.history(live.session.sessionId).session.sessionId, live.snapshot.sessionId);
  } finally { await reopened.close(); }
  console.log("PASS instance reload: independent REPLs, live state retention, active locality binding, atomic duplicate identity rejection, command/private versus Python/public views, editing, rollback, modes and history identity");
});
