import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, rename, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { waitForSessionCondition } from "./derivation/wait-for-session-condition.mjs";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pa-"));
  let host, gateway, client, web;
  onCleanup(async () => {
    await web?.close();
    client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  });
  const { agentDir } = initializePrkHome(root);
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "project-archive", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  runtime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 40 }, () => (context) => {
    const last = context.messages.at(-1);
    const message = typeof last?.content === "string" ? last.content : last?.content?.filter((part) => part.type === "text").map((part) => part.text).join("");
    const command = /^SPAWN (.*)$/s.exec(message || "");
    return command ? fauxAssistantMessage(fauxToolCall("session_spawn", JSON.parse(command[1])), { stopReason: "toolUse" }) : fauxAssistantMessage("Ready");
  }));
  host = await createGatewayHost({ cwd: root, home: root, model: "project-archive/controlled",
    config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { workerTools: "direct", capabilities: { "lazy:tool:session_spawn": false } } }),
    targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture", local: true, cwd: root })],
  }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
  const socket = join(root, "g.sock");
  gateway = await startGateway(host, socket);
  client = await connectGateway(socket);
  web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0 });
  const create = async (label) => (await client.request("createSession", { target: "fixture", label })).session.sessionId;
  const http = async (path, body) => {
    const response = await fetch(`${web.server.url}/api${path}`, body === undefined ? {} : { method: "POST", headers: { Origin: web.server.url, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const project = { id: "project-batch", name: "批量归档项目" };
  const parent = await create("Parent"), second = await create("Second");
  host.assignProject(parent, project);
  host.assignProject(second, project);
  const submitted = await host.session(parent).submit({ requestId: "spawn", message: `SPAWN ${JSON.stringify({ context: "Archive integration", tasks: [{ task: "Owned child", label: "Owned", lifecycle: "persistent" }, { task: "Retained child", label: "Retained", lifecycle: "persistent" }] })}` });
  assert(submitted.accepted);
  assert.equal((await submitted.completion).status, "completed");
  const children = host.workbench().sessions.filter((row) => row.derivation?.owner === parent);
  assert.equal(children.length, 2);
  for (const child of children) await waitForSessionCondition(() => host.session(child.sessionId).isIdle, `child ${child.sessionId}`);
  const [owned, retained] = children.map((row) => row.sessionId);
  await host.manageSession(retained, { action: "upgrade" });
  host.assignProject(retained, null);
  // The owned child belongs to the same project: its plan overlaps the parent's.
  host.assignProject(owned, project);
  const directory = join(root, "memories", "projects", project.id);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "MEMORY.md"), "keep project files\n");
  const preview = await http(`/projects/${project.id}/archive-preview`);
  assert.deepEqual(preview.sessions.map((node) => node.sessionId).sort(), [parent, second, owned].sort());
  assert.equal(preview.sessions.find((node) => node.sessionId === owned).owner, parent);
  assert.deepEqual(preview.retained.map((node) => node.sessionId), [retained]);
  const result = await http(`/projects/${project.id}/archive`, { confirm: true });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.archived.map((node) => node.sessionId).sort(), [parent, second, owned].sort());
  assert.deepEqual(result.unarchived, []);
  assert.equal(await readFile(join(directory, "MEMORY.md"), "utf8"), "keep project files\n");
  assert(host.workbench().sessions.some((row) => row.sessionId === retained));
  const archived = host.workbench().archive.flatMap((group) => group.sessions);
  assert.equal(archived.filter((node) => node.projectId === project.id).length, 3);
  assert.equal(archived.find((node) => node.sessionId === owned).owner, parent);
  // Real filesystem failure at the second member, after the first has been persisted.
  const failingProject = { id: "project-failure", name: "归档失败项目" };
  const ids = [await create("Before"), await create("Failure"), await create("After")];
  for (const id of ids) host.assignProject(id, failingProject);
  const files = await readdir(join(root, "sessions"));
  const headers = await Promise.all(files.filter((name) => name.endsWith(".jsonl")).map(async (name) => ({ name, id: JSON.parse((await readFile(join(root, "sessions", name), "utf8")).split("\n")[0]).id })));
  const file = headers.find((header) => header.id === ids[1]);
  assert(file, "Native SDK file is present");
  const path = join(root, "sessions", file.name);
  await rename(path, `${path}.saved`);
  await mkdir(path);
  let failed;
  try { failed = await http(`/projects/${failingProject.id}/archive`, { confirm: true }); }
  finally { await rm(path, { recursive: true }); await rename(`${path}.saved`, path); }
  assert(failed.error?.message);
  assert.deepEqual(failed.archived.map((node) => node.sessionId), [ids[0]]);
  assert.deepEqual(failed.unarchived.map((node) => node.sessionId), ids.slice(1));
  assert(host.workbench().sessions.some((node) => node.sessionId === ids[2]), "Failure stops before the third member");
  assert.throws(() => client.request("archiveProject", { projectId: failingProject.id, confirm: false }));
  assert.throws(() => client.request("archiveProjectPreview", { projectId: failingProject.id, extra: true }));
  console.log("PASS project archive: real preview merge, owned/retained, persistence, project files, stop-on-filesystem-failure");
});
