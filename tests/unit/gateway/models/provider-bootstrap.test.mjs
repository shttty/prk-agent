import assert from "node:assert/strict";
import test from "node:test";
import { createProviderBootstrap } from "../../../../src/gateway/models/create-provider-bootstrap.ts";

const request = (providerId, operation, source = "npm:first") => ({ providerId, operation, source, extensionPath: `/${source}/index.ts` });

test("bootstrap accepts unregister-before-register without claiming an ID or reporting an error", () => {
  const { modelProviders, providerPolicy, finish } = createProviderBootstrap([]);
  assert.equal(providerPolicy(request("clp-plugin", "unregister")), false);
  assert.equal(modelProviders.owners.size, 0);
  assert.deepEqual(modelProviders.errors, []);
  assert.equal(providerPolicy(request("clp-plugin", "register")), true);
  assert.equal(modelProviders.owners.get("clp-plugin").source, "npm:first");
  assert.deepEqual(modelProviders.errors, []);
  assert.equal(typeof providerPolicy(request("clp-plugin", "unregister", "npm:later")), "string");
  assert.equal(modelProviders.owners.get("clp-plugin").source, "npm:first");
  finish();
  assert.equal(providerPolicy(request("clp-plugin", "unregister")), true);
  assert.equal(providerPolicy(request("clp-plugin", "register")), true);
  assert.equal(typeof providerPolicy(request("unknown", "unregister")), "string");
  assert.equal(modelProviders.errors.at(-1).code, "PROVIDER_POLICY");
  assert.equal(modelProviders.errors.at(-1).providerId, "unknown");
  assert.equal(modelProviders.errors.at(-1).operation, "unregister");
});

test("manual provider keys reject unregister-before-register and never grant plugin ownership", () => {
  const { modelProviders, providerPolicy } = createProviderBootstrap(["clp"]);
  assert.equal(typeof providerPolicy(request("clp", "unregister")), "string");
  assert.equal(typeof providerPolicy(request("clp", "register")), "string");
  assert.equal(modelProviders.owners.size, 0);
  assert.deepEqual(modelProviders.errors.map(({ code, providerId, operation }) => ({ code, providerId, operation })), [
    { code: "PROVIDER_POLICY", providerId: "clp", operation: "unregister" },
    { code: "PROVIDER_POLICY", providerId: "clp", operation: "register" },
  ]);
});
