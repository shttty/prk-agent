import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { loadPrkConfig } from "../../../src/config/document/load-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";

const home = process.env.PRK_HOME, socket = process.env.PRK_SOCKET, evidence = process.env.PRK_EVIDENCE;
if (![home, socket, evidence, process.env.HOME, process.env.PI_TEST_PYTHON].every((value) => value && isAbsolute(value))) throw new Error("Explicit owned HOME/PRK_HOME/PRK_SOCKET/PRK_EVIDENCE/PI_TEST_PYTHON are required");
mkdirSync(evidence, { recursive: true });
const agentDir = join(evidence, "controlled-agent");
mkdirSync(agentDir, { recursive: true });
const config = await loadPrkConfig(home);
const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
const provider = fauxProvider({ provider: "s6-controlled", models: [{ id: "local" }], tokensPerSecond: 100000 });
modelRuntime.registerNativeProvider(provider.provider);
provider.setResponses(Array.from({ length: 1000 }, () => async (context) => {
  appendFileSync(join(evidence, "provider-calls.jsonl"), JSON.stringify({ at: Date.now() }) + "\n");
  if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Controlled tool execution observed.");
  const message = context.messages.findLast((entry) => entry.role === "user");
  const text = typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const match = /^S6_TOOL (.*)$/s.exec(text);
  if (!match) return fauxAssistantMessage("Controlled rehearsal: send S6_TOOL followed by a JSON object with name and args.");
  const { name, args } = JSON.parse(match[1]);
  return fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });
}));
let host;
const environments = createTargetEnvironments({ resolve: (id) => {
  const target = host.getTarget(id);
  return target.local ? { local: true } : { local: false, command: target.sshCommand };
} });
const targetEnvironments = { acquire: (id) => {
  appendFileSync(join(evidence, "target-acquires.jsonl"), JSON.stringify({ target: id, at: Date.now() }) + "\n");
  return environments.acquire(id);
} };
host = await createGatewayHost({ cwd: home, home, config, model: "s6-controlled/local" }, {
  runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetEnvironments },
});
const gateway = await startGateway(host, socket, config.gateway, config.limits);
const web = await startWebApplication({ home, socket, host: "127.0.0.1", port: Number(process.env.PRK_API_PORT) });
writeFileSync(join(evidence, "ready.json"), JSON.stringify({ pid: process.pid, home, socket, api: `http://127.0.0.1:${process.env.PRK_API_PORT}`, sessions: host.workbench().sessions.length }) + "\n");
console.log("S6_REHEARSAL_READY");
const stop = async () => { await web.close(); await gateway.close(); };
process.once("SIGTERM", () => { void stop(); });
process.once("SIGINT", () => { void stop(); });
await gateway.closed;
