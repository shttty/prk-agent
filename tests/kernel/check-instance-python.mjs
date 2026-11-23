import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const home = await mkdtemp(join(tmpdir(), "prk-kernel-default-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir, { recursive: true });
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { prepareGatewayEnvironment } = await import("../fixtures/prepare-gateway-environment.mjs");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const text = message => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter(part => part.type === "text").map(part => part.text).join("\n");
let host, server, client;
try {
  await withTargetFixture(async ({ config, tempRoot }) => {
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    const provider = fauxProvider({ provider: "kernel-default-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    runtime.registerNativeProvider(provider.provider);
    provider.setResponses(Array.from({ length: 100 }, () => async context => {
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Observed target behavior.");
      const message = [...context.messages].reverse().find(entry => entry.role === "user");
      const command = /^TOOL (.*)$/s.exec(text(message));
      if (command) { const { name, args } = JSON.parse(command[1]); return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" }); }
      return fauxAssistantMessage("Task admitted, without implicit result submission.");
    }));
    const raw = { instances: [{ id: "target", label: "Owned target", ...config }] };
    const dependencies = { runtimeDependencies: { model: provider.getModel("controlled"), modelRuntime: runtime, thinkingLevel: "off", cwd: home, agentDir } };
    async function start(document, label) {
      host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig({ session: { workerTools: "direct", localTools: true } }, document), historyDir: join(home, label), model: "kernel-default-check/controlled" }, dependencies);
      server = await startGateway(host, join(home, "g.sock"));
      client = await connectGateway(join(home, "g.sock"));
    }
    let request = 0;
    async function call(worker, name, args, expectedError = false) {
      const operation = await host.session(worker).submit({ requestId: `default-${++request}`, message: `TOOL ${JSON.stringify({ name, args })}` });
      assert(operation.accepted); assert.equal((await operation.completion).status, "completed");
      const snapshot = host.session(worker).getSnapshot();
      const projected = snapshot.messages.findLast(entry => entry.role === "toolResult" && entry.toolName === name);
      const result = projected?.outputPreview
        ? (await client.request("toolContent", { sessionId: worker, toolCallId: projected.toolCallId })).result
        : projected;
      assert(result); assert.equal(Boolean(result.isError), expectedError, text(result));
      return result;
    }
    async function stop() { await client.disconnect(); client = undefined; await server.close(); server = undefined; host = undefined; }
    await start(raw, "with-default");
    await prepareGatewayEnvironment(host, home, "target");
    const owner = (await host.createSession({ target: "target", cwd: tempRoot, label: "Instance owner" })).session.sessionId;
    const discovery = JSON.parse(text(await call(owner, "space_status", { target: "target" })));
    assert.equal(discovery.targets[0].python, config.python);
    assert.equal(Object.hasOwn(discovery, "kernels"), false, "Discovery does not invent a kernelspec catalog");
    const omitted = (await client.request("createSession", { target: "target" })).session;
    await assert.rejects(async () => client.request("createSession", { target: "target", kernelName: "removed" }), error => error.code === "INVALID_REQUEST");
    await assert.rejects(async () => client.request("createSession", { target: "target", python: config.python }), error => error.code === "INVALID_REQUEST");
    assert.equal(Object.hasOwn(omitted, "kernelName"), false);
    const executed = await call(omitted.sessionId, "kernel_code", { code: `import os, sys\nfrom pathlib import Path\nassert os.path.samefile(sys.executable, ${JSON.stringify(config.python)})\nassert Path('/proc/self/cgroup').read_text().strip().endswith('.scope')\nprint('OMITTED_DEFAULT_EXECUTED')` });
    assert.match(text(executed), /OMITTED_DEFAULT_EXECUTED/);
    const child = JSON.parse(text(await call(owner, "session_spawn", { context: "Use the target instance Python.", tasks: [{ task: "Use the configured interpreter", label: "Instance child" }] }))).children[0];
    const childRow = host.workbench().sessions.find(entry => entry.sessionId === child.sessionId);
    assert.equal(childRow.target, "target");
    assert.equal(childRow.cwd, tempRoot, "same-target children inherit their creator's cwd");
    assert.equal(Object.hasOwn(childRow, "kernelName"), false);
    await call(omitted.sessionId, "kernel_code", { code: "child=gateway.session_spawn(context='Use the target instance interpreter.', tasks=[{'task':'Worker uses instance Python', 'label':'Worker instance Python'}])['children'][0]\nassert child['sessionName'] == 'Worker instance Python'\nprint(child['sessionId'])" });
    const defaultChild = host.workbench().sessions.find(entry => entry.derivation?.createdBy === omitted.sessionId);
    assert.equal(defaultChild.target, "target");
    assert.equal(defaultChild.cwd, tempRoot, "same-target worker children keep their creator's cwd");
    await stop();
    const { python, ...pending } = raw.instances[0];
    pending.local = false;
    delete pending.sshCommand;
    await start({ instances: [pending] }, "pending-connection");
    const dormant = (await client.request("createSession", { target: "target" })).session;
    assert.equal(dormant.configurationIssue.code, "SSH_COMMAND_REQUIRED");
    assert.equal(dormant.state, "sleeping");
    await assert.rejects(client.request("send", { sessionId: dormant.sessionId, requestId: "pending-refusal", message: "must not call provider" }), error => error.code === "INVALID_REQUEST" && error.details?.submitted === false && error.details?.configurationIssue?.code === "SSH_COMMAND_REQUIRED");
    assert.equal(host.workbench().sessions.length, 1, "Pending creation remains readable without creating runtime children");
    await stop();
    console.log("PASS instance Python: Gateway create, child spawn, worker callback, scoped execution, removed overrides, and pending admission refusal");
  });
} finally {
  if (client) await client.disconnect();
  if (server) await server.close(); else if (host) await host.close();
  await rm(home, { recursive: true, force: true });
}
