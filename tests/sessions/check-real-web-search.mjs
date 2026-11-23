import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { createHostFixture } from "../target-environment/host/create-host-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const machine = process.argv[2] ?? "local";
assert(process.env.PI_TEST_PLUGIN_AGENT);
const root = await mkdtemp(join(tmpdir(), "prk-real-web-search-"));
const previousHome = process.env.HOME;
process.env.HOME = root;
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
const requests = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://owned");
  requests.push({ path: url.pathname, query: url.searchParams.get("q"), address: request.socket.remoteAddress, pid: process.pid });
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ results: [{ title: "Owned search endpoint", url: "https://example.com/owned-result", content: `GATEWAY_WEB_SEARCH_${url.searchParams.get("q")}` }] }));
});
let fixture;
let host;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await mkdir(agentDir, { recursive: true });
  const source = join(process.env.PI_TEST_PLUGIN_AGENT, "npm/node_modules/pi-web-access");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "gateway" }], compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
  await writeFile(join(agentDir, "web-search.json"), JSON.stringify({ toolActivation: "eager", searxngBaseUrl: `http://127.0.0.1:${server.address().port}`, webSearch: { allowedProviders: ["searxng"] }, ssrf: { allowRanges: ["127.0.0.1/32"] } }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "owned-web-control", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  fixture = await createHostFixture(machine, new ArtifactStore(join(home, "assets")));
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, remoteHost: { runtime: "node" }, session: { noExtensions: false, noSkills: true, workerTools: "code", idleTimeoutMs: 60000 } }, { instances: [{ id: "owned", label: "Owned web search", local: machine === "local", ...(machine === "office" ? { sshCommand: fixture.fixture.command } : {}), python: machine === "office" ? process.env.PI_TEST_REMOTE_PYTHON : process.env.PI_TEST_PYTHON, cwd: fixture.fixture.root }] });
  host = await createGatewayHost({ cwd: home, home, config, targets: config.instances, model: "owned-web-control/controlled", thinkingLevel: "off" }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: fixture.channels } });
  await prepareGatewayEnvironment(host, home, "owned");
  const created = await host.createSession({ target: "owned", cwd: fixture.fixture.root });
  const sessionId = created.session.sessionId;
  for (const route of ["direct", "kernel"]) {
    const id = randomUUID();
    const marker = `${machine}-${route}`;
    const name = route === "direct" ? "web_search" : "kernel_code";
    const args = route === "direct" ? { queries: [marker], provider: "searxng" } : { code: `import os, socket\nprint('OWNED_KERNEL', socket.gethostname(), os.getpid())\nresult = gateway.web_search(queries=[${JSON.stringify(marker)}], provider='searxng')\nprint(result)\nassert 'GATEWAY_WEB_SEARCH_' in str(result)` };
    provider.setResponses([fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Owned route observed")]);
    const operation = await host.session(sessionId).submit({ requestId: id, message: `Exercise owned ${route} search` });
    assert.equal((await operation.completion).status, "completed");
    const result = host.state(sessionId).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
    assert(result && !result.isError, JSON.stringify(result));
    assert(JSON.stringify(result).includes(`GATEWAY_WEB_SEARCH_${marker}`), JSON.stringify(result));
    assert(requests.some(({ query, address }) => query === marker && address === "127.0.0.1"), JSON.stringify(requests));
    console.log(JSON.stringify({ machine, route, gatewayPid: process.pid, sessionId, result }));
  }
  assert.equal(requests.length, 2);
  console.log(JSON.stringify({ proof: "real pi-web-access web_search uses Gateway loopback for both native direct and target Python gateway callback", requests }));
} finally {
  await host?.close(); await fixture?.close();
  await new Promise((resolve) => server.close(resolve));
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
