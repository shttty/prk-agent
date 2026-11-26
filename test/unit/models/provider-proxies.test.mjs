import assert from "node:assert/strict";
import test from "node:test";
import { readProviderProxies } from "../../../src/gateway/models/provider-proxy/read-provider-proxies.ts";

const relay = (extra) => ({ providers: { relay: { baseUrl: "https://relay.example/v1", api: "openai-completions", models: [{ id: "a" }], ...extra } } });

test("models.json proxy reads into typed proxies and the APIs their models use", () => {
  assert.deepEqual(readProviderProxies(undefined), { providers: new Map(), apis: new Set() });
  assert.deepEqual(readProviderProxies(relay({})), { providers: new Map(), apis: new Set() });
  const proxied = readProviderProxies(relay({ proxy: "http://user:pass@proxy.example:3128", models: [{ id: "a" }, { id: "b", api: "anthropic-messages" }] }));
  assert.equal(proxied.providers.get("relay").href, "http://user:pass@proxy.example:3128/");
  assert.deepEqual(proxied.apis, new Set(["openai-completions", "anthropic-messages"]));
  assert.equal(readProviderProxies(relay({ proxy: "https://proxy.example" })).providers.get("relay").protocol, "https:");
  assert.equal(readProviderProxies(relay({ proxy: false })).providers.get("relay"), "direct");
});

test("models.json proxy rejects other values without echoing them", () => {
  for (const proxy of [true, 3128, null, "", "proxy.example:3128", "socks5://proxy.example", "ftp://proxy.example"]) {
    assert.throws(() => readProviderProxies(relay({ proxy })), (error) => {
      assert.equal(error.message, 'models.json provider "relay": proxy must be an http:// or https:// URL, or false.');
      return true;
    });
  }
});

test("models.json proxy rejects providers whose requests would not go through it", () => {
  assert.throws(() => readProviderProxies({ providers: { anthropic: { baseUrl: "https://relay.example", proxy: false } } }), /"anthropic": proxy is not supported on a Pi built-in provider ID/);
  assert.throws(() => readProviderProxies(relay({ oauth: "radius", proxy: false })), /"relay": proxy is not supported on a Pi built-in provider ID/);
  assert.throws(() => readProviderProxies(relay({ proxy: false, models: [{ id: "a", api: "bedrock-converse-stream" }] })), /"relay": proxy is not supported for api "bedrock-converse-stream"/);
});
