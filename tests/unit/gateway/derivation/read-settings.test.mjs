import assert from "node:assert/strict";
import { test } from "node:test";
import { Value } from "typebox/value";
import { parseDerivationConfig } from "../../../../src/config/derivation/parse-config.ts";
import { DEFAULT_DERIVATION_ROLES } from "../../../../src/config/derivation/derivation-types.ts";
import { derivationGet } from "../../../../src/gateway/derivation/read-derivation-settings.ts";
import { readSpaceStatus } from "../../../../src/gateway/derivation/read-space-status.ts";
import { createSpaceStatusTool } from "../../../../src/plugins/sessions/space-status/create-space-status-tool.ts";

test("derivation settings separate merged roles from the immutable built-in baseline", () => {
  const config = parseDerivationConfig({ derivation: { roles: { task: { model: "fixture/task" }, small: { toolMode: "code" }, reviewer: { description: "Review" } } } });
  const settings = derivationGet({ derivation: { derivationConfig: config }, host: { config: { session: { workerTools: "code" } } } });
  assert.equal(settings.derivation, config);
  assert.equal(settings.defaults.roles, DEFAULT_DERIVATION_ROLES);
  assert.deepEqual(settings.derivation.roles.task, { ...settings.defaults.roles.task, model: "fixture/task" });
  assert.equal(settings.derivation.roles.small.toolMode, "code");
  assert.equal(settings.defaults.roles.small.toolMode, "direct");
  assert.deepEqual(settings.derivation.roles.reviewer, { description: "Review" });
  assert.equal(Object.hasOwn(settings.defaults, "defaultModel"), false);
  assert.equal(Object.hasOwn(settings.defaults, "defaultThinkingLevel"), false);
});

test("space status discovers built-ins and omits only the removed derivation model defaults", async () => {
  const config = parseDerivationConfig({ derivation: { defaultToolMode: "direct", defaultIsolated: true, maxDepth: 5, roles: { task: { model: "fixture/task", thinkingLevel: "low" }, reviewer: { description: "Review" } } } });
  const ctx = {
    host: { config: { session: { workerTools: "code" } } }, derivation: { derivationConfig: config }, instances: { targets: [] },
    methods: {
      modelCatalog: () => ({ models: [], defaultModel: "fixture/catalog", defaultThinkingLevel: "medium" }),
      managed: () => [],
    },
  };
  ctx.methods.derivationGet = () => derivationGet(ctx);
  const result = await readSpaceStatus(ctx);
  assert.deepEqual(result.roles.map(({ name }) => name), ["task", "small", "reviewer"]);
  assert.deepEqual(result.roles.find(({ name }) => name === "small"), { name: "small", ...DEFAULT_DERIVATION_ROLES.small });
  assert.deepEqual(result.derivationDefaults, { toolMode: "direct", isolated: true, maxDepth: 5 });
  assert.equal(result.defaultModel, "fixture/catalog");
  assert.equal(result.defaultThinkingLevel, "medium");
  const schema = createSpaceStatusTool({}).outputSchema;
  assert.equal(Value.Check(schema, result), true);
  assert.equal(Value.Check(schema, { ...result, derivationDefaults: { ...result.derivationDefaults, model: "fixture/retired" } }), false);
  assert.equal(Value.Check(schema, { ...result, derivationDefaults: { ...result.derivationDefaults, thinkingLevel: "off" } }), false);
});
