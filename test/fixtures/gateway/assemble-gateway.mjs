import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { stringify } from "smol-toml";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";
import { prepareArtifacts } from "./prepare-artifacts.mjs";
import { until } from "../until.mjs";

export async function gatewayFixture(t, { answer, remote = false, web = false, rate = 100_000, config = {}, settings = {} } = {}) {
  const python = process.env.PI_TEST_PYTHON;
  assert(python && isAbsolute(python), "PI_TEST_PYTHON must be an absolute interpreter path");
  const root = await mkdtemp(join(tmpdir(), "g-"));
  const agent = join(root, "agent");
  const cwd = join(root, "cwd");
  const target = "fixture";
  const cleanup = [() => rm(root, { recursive: true, force: true })];
  t.after(async () => {
    const errors = [];
    for (const close of cleanup.reverse()) {
      try { await close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Gateway fixture cleanup failed");
  });
  await Promise.all([mkdir(agent), mkdir(cwd)]);
  const instances = [{ id: target, label: "Owned fixture", cwd, python, ...(remote ? { sshCommand: "exec /bin/sh" } : { local: true }) }];
  await Promise.all([
    writeFile(join(root, "instances.toml"), stringify({ instances }), { mode: 0o600 }),
    writeFile(join(agent, "settings.json"), JSON.stringify({ compaction: { enabled: false, keepRecentTokens: 32 }, retry: { enabled: false }, ...settings })),
  ]);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agent, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "verification", models: [{ id: "faux", reasoning: true, input: ["text", "image"] }], tokensPerSecond: rate });
  const model = provider.getModel();
  modelRuntime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 300 }, () => (context, options) => {
    const last = context.messages.at(-1);
    const body = text(last);
    if (last?.role === "user" && body.startsWith("TOOL ")) {
      const { name, args } = JSON.parse(body.slice(5));
      return tool(name, args);
    }
    return answer?.(context, options) ?? fauxAssistantMessage("Controlled reply.");
  }));
  const parsed = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, targetCacheRoot: join(root, "target"), session: { workerTools: "direct" }, ...config }, { instances });
  const host = await createGatewayHost({ cwd, home: root, model: `${model.provider}/${model.id}`, thinkingLevel: "off",
    config: parsed,
  }, { runtimeDependencies: { cwd, agentDir: agent, model, modelRuntime, thinkingLevel: "off" } });
  let listener;
  cleanup.push(() => listener ? listener.close() : host.close());
  const socket = join(root, "g.sock");
  listener = await startGateway(host, socket);
  const client = await connectGateway(socket);
  cleanup.push(() => client.disconnect());
  let url;
  if (web) {
    const adapter = await connectWebGateway({ socket, home: root, http: parsed.http });
    cleanup.push(() => adapter.close());
    const server = await startWebServer(adapter, { host: "127.0.0.1", port: 0, home: root, http: parsed.http });
    cleanup.push(() => server.close());
    url = server.url;
  }
  const request = (method, params) => client.request(method, params);
  const create = async (label = "Test conversation") => (await request("createSession", { target, label })).session.sessionId;
  const send = (sessionId, message, params = {}) => request("send", { sessionId, message, mode: "auto", requestId: crypto.randomUUID(), ...params });
  const state = (sessionId) => host.session(sessionId).getSnapshot();
  const complete = async (sessionId, receipt) => {
    assert.equal(receipt.accepted, true, JSON.stringify(receipt));
    return until(() => state(sessionId).recentOperations.find((item) => item.operationId === receipt.operationId), `terminal operation ${receipt.operationId}`);
  };
  const deploy = async () => {
    await prepareArtifacts(root);
    await request("deployTargetEnvironment", { target });
    const result = await until(async () => {
      const value = await request("getTargetEnvironment", { target });
      return ["ready", "failed"].includes(value.status) && value;
    }, "instance environment deployment", 60_000);
    assert.equal(result.status, "ready", JSON.stringify(result));
    return result;
  };
  return { root, cwd, target, host, client, provider, url, create, send, state, complete, deploy, request, onCleanup: (fn) => cleanup.push(fn) };
}

export function text(message) {
  return typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
}

export function tool(name, args) {
  return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });
}
