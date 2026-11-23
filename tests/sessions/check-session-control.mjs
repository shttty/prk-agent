import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-session-control-"));
  const socket = join(root, "gateway.sock");
  let host, endpoint, client, webClient, web;
  onCleanup(async () => {
    await web?.close();
    await webClient?.close();
    client?.disconnect();
    if (endpoint) await endpoint.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "control-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(faux.provider);
  faux.setResponses(Array.from({ length: 50 }, () => (context) => {
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("Designation finished.");
    const command = /^CONTROL (\{.*\})$/s.exec(text(last));
    return command ? fauxAssistantMessage(fauxToolCall("session_manage", JSON.parse(command[1])), { stopReason: "toolUse" })
      : fauxAssistantMessage("Ready.");
  }));
  const options = {
    cwd: root, home: root, model: "control-check/controlled",
    config: parsePrkConfig({ session: { workerTools: "direct", capabilities: { "lazy:tool:session_manage": false } } }),
    targets: [
      executionTargetFromConfig({ ...config, id: "local", label: "Local", local: true, cwd: root }),
      executionTargetFromConfig({ ...config, id: "remote", label: "Remote", local: false, sshCommand: "/bin/sh", cwd: root }),
    ],
  };
  const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } };
  async function open() {
    host = await createGatewayHost(options, dependencies);
    endpoint = await startGateway(host, socket);
    client = await connectGateway(socket);
  }
  await open();
  const create = async (target = "local") => (await host.createSession({ target })).session;
  const a = await create(), b = await create(), c = await create();
  const remote = await create("remote");
  const native = (name) => host.state(name).sessionId;
  assert.equal(a.sessionId, native(a.sessionId), "Gateway routes use the native SDK identity");
  assert.deepEqual(await client.request("sessionControl"), { rootSessionId: null, supervisors: {} });
  await assert.rejects(client.request("setSessionRoot", { sessionId: remote.sessionId }), /local/i);
  await client.request("setSessionRoot", { sessionId: a.sessionId });
  const replacement = await client.request("setSessionRoot", { sessionId: b.sessionId });
  assert.equal(replacement.rootSessionId, native(b.sessionId), "One native id replaces the former root");
  const project = { id: "project-control", name: "Control roles" };
  host.assignProject(b.sessionId, project);
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "First project member becomes supervisor");
  host.assignProject(a.sessionId, project);
  host.assignProject(c.sessionId, project);
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "Older session joining later does not displace a surviving supervisor");
  await client.request("setProjectSupervisor", { sessionId: c.sessionId });
  const saved = host.sessionControl();
  client.disconnect(); client = undefined;
  await endpoint.close(); endpoint = undefined;
  await open();
  assert.deepEqual(await client.request("sessionControl"), saved, "Unique root and manual supervisor persist across Gateway reconstruction");
  let requestId = 0;
  async function designate(actor, session, error = false) {
    const submission = await host.session(actor).submit({ requestId: `control-${++requestId}`, message: `CONTROL ${JSON.stringify({ action: "supervisor", session })}` });
    assert.equal(submission.accepted, true);
    assert.equal((await submission.completion).status, "completed");
    const result = host.session(actor).getSnapshot().messages.findLast((message) => message.role === "toolResult" && message.toolName === "session_manage");
    assert(result, "session_manage executes through the real SDK");
    assert.equal(result.isError === true, error, text(result));
    if (error) assert.match(text(result), /root/i);
  }
  await designate(a.sessionId, native(b.sessionId), true);
  await designate(c.sessionId, native(b.sessionId), true);
  await designate(b.sessionId, native(a.sessionId));
  assert.equal(host.sessionControl().supervisors[project.id], native(a.sessionId), "Root model may designate another project member");
  host.assignProject(a.sessionId, { id: "project-moved", name: "Moved supervisor" });
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "Moving supervisor elects earliest remaining SDK creation");
  assert.equal(host.sessionControl().supervisors["project-moved"], native(a.sessionId));
  await designate(b.sessionId, native(c.sessionId));
  await host.archiveSession(c.sessionId, { confirm: true });
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "Archived supervisor is replaced immediately");
  await assert.rejects(client.request("setSessionRoot", { sessionId: c.sessionId }), /archived/i);
  await assert.rejects(client.request("setProjectSupervisor", { sessionId: c.sessionId }), /archived/i);
  await host.unarchive(c.sessionId);
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "Unarchive does not steal a surviving supervisor's role");
  webClient = await connectWebGateway({ socket });
  web = await startWebServer(webClient, { home: root, host: "127.0.0.1", port: 0 });
  // Roles are part of the workbench snapshot; there is no separate read endpoint.
  const response = await fetch(`${web.url}/api/workbench`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sessionControl, host.sessionControl());
  assert.equal((await fetch(`${web.url}/api/session-control`)).status, 404);
  const changed = await fetch(`${web.url}/api/session-control/supervisor`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ sessionId: c.sessionId }),
  });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).supervisors[project.id], native(c.sessionId), "HTTP user designation is unrestricted");
  const rooted = await fetch(`${web.url}/api/session-control/root`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ sessionId: a.sessionId }),
  });
  assert.equal(rooted.status, 200);
  assert.equal((await rooted.json()).rootSessionId, native(a.sessionId));
  const invalid = await fetch(`${web.url}/api/session-control/root`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ sessionId: a.sessionId, actor: b.sessionId }),
  });
  assert.equal(invalid.status, 400, "User role route rejects undeclared authority fields");
  await host.archiveSession(a.sessionId, { confirm: true });
  assert.equal(host.sessionControl().rootSessionId, null, "Archiving root clears the designation without selecting a successor");
  assert.equal(host.sessionControl().supervisors["project-moved"], undefined, "Empty projects have no supervisor");
  await host.unarchive(a.sessionId);
  assert.equal(host.sessionControl().rootSessionId, null, "Unarchiving never reclaims a former root designation");
  await web.close(); web = undefined;
  await webClient.close(); webClient = undefined;
  client.disconnect(); client = undefined;
  await endpoint.close(); endpoint = undefined;
  await rm(join(root, "session-control.json"));
  await open();
  assert.equal(host.sessionControl().rootSessionId, null, "Existing SDK membership does not invent a root");
  assert.equal(host.sessionControl().supervisors[project.id], native(b.sessionId), "Startup without prior role choices elects the earliest existing member");
  assert.equal(host.sessionControl().supervisors["project-moved"], native(a.sessionId));
  console.log("session control: persistent native roles, local root, model designation, membership succession and real wire/HTTP routes covered");
});
