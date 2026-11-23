import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { stringify } from "smol-toml";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { prepareGatewayEnvironment } from "../prepare-gateway-environment.mjs";
import { startWebDev } from "../web-dev.mjs";

export const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
export async function until(read, label, timeout = 30_000) {
  const deadline = performance.now() + timeout;
  for (;;) {
    const value = await read();
    if (value) return value;
    assert(performance.now() < deadline, `Timed out: ${label}`);
    await delay(40);
  }
}

export async function createKernelAsyncFixture({ config, tempRoot: home, onCleanup, respond, capabilities, session }) {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  // Bind the isolated SDK home before importing Pi; no model network or daily services.
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");
  const { startWebApplication } = await import("../../../src/http/application/start-application.ts");
  const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "kernel-async-setting", models: [{ id: "controlled", input: ["text", "image"] }], tokensPerSecond: 100_000 });
  runtime.registerNativeProvider(provider.provider);
  const requests = [], results = new Map();
  provider.setResponses(Array.from({ length: 100 }, () => (context, options) => {
    const last = context.messages.findLast((message) => message.role !== "system");
    const request = { tools: getCurrentTools(context.messages).map(({ name }) => name), messages: structuredClone(context.messages), last };
    requests.push(request);
    if (last?.role === "toolResult") results.set(last.toolCallId, last);
    if (respond) return respond(context, options, request);
    if (last?.role === "toolResult") return fauxAssistantMessage("FIXTURE_TOOL_OBSERVED");
    const match = /^KERNEL_ASYNC_FIXTURE (\{.*\})$/s.exec(text(last));
    if (!match) return fauxAssistantMessage("FIXTURE_NATIVE_EVENT_OBSERVED");
    const input = JSON.parse(match[1]);
    request.id = input.id;
    return typeof input.code === "string"
      ? fauxAssistantMessage(fauxToolCall("kernel_code", { code: input.code, title: input.id, yield_s: 0 }, { id: input.id }), { stopReason: "toolUse" })
      : fauxAssistantMessage("FIXTURE_DECLARATIONS_OBSERVED");
  }));
  const document = { session: { noExtensions: true, noSkills: true, workerTools: "direct", idleTimeoutMs: 120_000, ...(capabilities ? { capabilities } : {}), ...session }, memory: { review: false },
    kernel: { asyncExecution: true, reminderLadderMs: [12_000, 60_000], maxOutputChars: 4096 }, targetCacheRoot: join(home, "cache") };
  const instances = { instances: [{ id: "fixture", label: "Owned Python", ...config }] };
  await writeFile(join(home, "config.toml"), `# KERNEL_ASYNC_UNRELATED_COMMENT\n${stringify(document)}`);
  await writeFile(join(home, "instances.toml"), stringify(instances), { mode: 0o600 });
  let host, gateway, client, web, ui, browser, port;
  onCleanup(async () => {
    await browser?.close();
    await ui?.close();
    await web?.close();
    client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
  });
  host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig(document, instances), model: "kernel-async-setting/controlled" }, {
    runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", autoCompaction: false },
  });
  const socket = join(home, "g.sock");
  gateway = await startGateway(host, socket);
  client = await connectGateway(socket);
  await prepareGatewayEnvironment(host, home, "fixture");
  const sessionId = (await client.request("createSession", { target: "fixture" })).session.sessionId;
  const explicit = process.env.PI_TEST_KERNEL_ASYNC_PORT;
  const ports = explicit === undefined ? [18790, 18791, 18792, 18793, 18794, 18795, 18796, 18798, 18799] : [Number(explicit)];
  assert(ports.every((value) => Number.isInteger(value) && value >= 18790 && value <= 18799 && value !== 18797), "PI_TEST_KERNEL_ASYNC_PORT must be 18790–18799, except 18797");
  const startWeb = (value) => startWebApplication({ socket, home, host: "127.0.0.1", port: value });
  for (const candidate of ports) {
    try { web = await startWeb(candidate); port = candidate; break; }
    catch (error) { if (error.code !== "EADDRINUSE") throw error; }
  }
  assert(web, "No free isolated API port in 18790–18799 (excluding 18797)");
  ui = await startWebDev(web.server.url);
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = () => client.request("state", { sessionId });
  const events = async (cellId, kind) => (await state()).messages.filter((message) => message.role === "custom" && message.customType === "kernel-event"
    && message.details?.cellId === cellId && (!kind || message.details.kind === kind));
  return { page, home, sessionId, requests, results, errors, state, events, apiUrl: web.server.url,
    uiUrl: ui.url, gate: (name) => join(home, name), release: (name) => writeFile(join(home, name), "go"),
    idle: () => until(async () => { const snapshot = await state(); return snapshot.state === "idle" && !snapshot.operation && snapshot; }, "SDK/host idle"),
    async restartWeb() { await web.close(); web = await startWeb(port); },
  };
}
