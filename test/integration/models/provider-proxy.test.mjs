import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { sharedModelRuntime } from "../../../src/gateway/models/load-model-runtime.ts";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";
import { startHttpProxy } from "../../fixtures/models/start-http-proxy.mjs";

test("a models.json proxy carries only its provider's requests; proxy:false bypasses the environment proxy", async (t) => {
  const [proxy, environment, endpoint] = await Promise.all([startHttpProxy(t), startHttpProxy(t), startCompletionsEndpoint(t)]);
  // NODE_USE_ENV_PROXY works by installing an environment proxy as the global undici dispatcher.
  setGlobalDispatcher(new ProxyAgent(environment.origin));
  const credentials = new URL(proxy.origin);
  credentials.username = "relay";
  credentials.password = "secret";
  const home = await prkHome(t, { proxied: relay(endpoint.baseUrl, { proxy: credentials.href }), inherited: relay(endpoint.baseUrl), direct: relay(endpoint.baseUrl, { proxy: false }) });
  const agentDir = join(home, "agent");
  const logs = [];
  t.mock.method(console, "info", (line) => logs.push(line));
  // The Gateway's shared model runtime, which every session uses for model requests.
  const runtime = await sharedModelRuntime({
    host: { dependencies: {}, paths: { home, agentDir }, options: {}, config: { session: { bootstrapNoSkills: true } } },
    models: {},
  });
  t.mock.restoreAll();
  assert.deepEqual(logs.filter((line) => line.startsWith("[provider-proxy]")), [`[provider-proxy] proxied: ${proxy.origin}`, "[provider-proxy] direct: direct"]);
  const ask = async (providerId) => {
    const reply = await runtime.completeSimple(runtime.getModel(providerId, "relay"), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] });
    assert.equal(reply.stopReason, "stop", reply.errorMessage);
  };
  const target = `${endpoint.baseUrl}/chat/completions`;
  await ask("proxied");
  assert.deepEqual(proxy.requests, [{ target, authorization: `Basic ${btoa("relay:secret")}` }]);
  await ask("inherited");
  assert.deepEqual(environment.requests, [{ target, authorization: undefined }]);
  await ask("direct");
  assert.equal(endpoint.requests.length, 3);
  assert.equal(proxy.requests.length + environment.requests.length, 2);
});

test("Gateway startup rejects a proxy on a Pi built-in provider ID and an invalid proxy URL", async (t) => {
  for (const [providers, message] of [
    [{ openai: { baseUrl: "http://127.0.0.1:9/v1", proxy: "http://127.0.0.1:9" } }, /"openai": proxy is not supported on a Pi built-in provider ID/],
    [{ relay: relay("http://127.0.0.1:9/v1", { proxy: "socks5://127.0.0.1:9" }) }, /"relay": proxy must be an http:\/\/ or https:\/\/ URL, or false/],
  ]) {
    const home = await prkHome(t, providers);
    await assert.rejects(createGatewayHost({ cwd: home, home, model: "relay/relay", config: parsePrkConfig({ monitor: { enabled: false } }, { instances: [] }) }), message);
  }
});

function relay(baseUrl, extra = {}) {
  return { baseUrl, api: "openai-completions", apiKey: "test", models: [{ id: "relay" }], ...extra };
}

async function prkHome(t, providers) {
  const home = await mkdtemp(join(tmpdir(), "proxy-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "agent"));
  await writeFile(join(home, "agent", "models.json"), JSON.stringify({ providers }));
  return home;
}
