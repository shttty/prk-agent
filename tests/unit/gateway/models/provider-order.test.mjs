import assert from "node:assert/strict";
import test from "node:test";
import { createProviderBootstrap } from "../../../../src/gateway/models/create-provider-bootstrap.ts";

const registration = (source) => ({ providerId: "shared-id", operation: "register", source, extensionPath: `/${source}/index.ts` });

test("provider ownership follows package order and later registration never replaces its owner", () => {
  for (const [first, later] of [["first-package", "later-package"], ["later-package", "first-package"]]) {
    const bootstrap = createProviderBootstrap([]);
    assert.equal(bootstrap.providerPolicy(registration(first)), true);
    assert.equal(typeof bootstrap.providerPolicy(registration(later)), "string");
    assert.deepEqual(bootstrap.modelProviders.owners.get("shared-id"), { source: first, extensionPath: `/${first}/index.ts` });
    assert.equal(bootstrap.modelProviders.errors[0].source, later);
    bootstrap.finish();
    assert.equal(bootstrap.providerPolicy(registration(first)), true);
    assert.equal(typeof bootstrap.providerPolicy(registration(later)), "string");
    assert.equal(bootstrap.modelProviders.owners.get("shared-id").source, first);
  }
});
