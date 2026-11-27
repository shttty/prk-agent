import assert from "node:assert/strict";
import { test } from "node:test";
import { skillScopePattern } from "../../../src/gateway/wire/scope-constants.ts";
import { collectBuiltinTools } from "../../fixtures/schemas/collect-builtin-tools.mjs";

// Model providers reject lookaround in tool JSON Schema (OpenAI: invalid_json_schema), which fails the whole request in direct mode.
const LOOKAROUND = /\(\?<?[=!]/u;

function* patterns(schema, path) {
  if (Array.isArray(schema)) { for (const [index, item] of schema.entries()) yield* patterns(item, `${path}[${index}]`); return; }
  if (typeof schema !== "object" || schema === null) return;
  for (const [key, value] of Object.entries(schema)) {
    if (key === "pattern" && typeof value === "string") yield [`${path}.pattern`, value];
    else yield* patterns(value, `${path}.${key}`);
  }
}

test("no builtin tool schema uses a lookaround in a pattern", () => {
  const found = collectBuiltinTools().flatMap((tool) => [...patterns(tool.parameters, `${tool.name}.parameters`), ...patterns(tool.outputSchema, `${tool.name}.outputSchema`)])
    .filter(([, pattern]) => LOOKAROUND.test(pattern));
  assert.deepEqual(found, []);
});

test("the skill scope pattern still rejects a trailing newline and control characters", () => {
  assert.ok(skillScopePattern.test("global") && skillScopePattern.test("project:abc") && skillScopePattern.test("instance:default"));
  for (const bad of ["global\n", "project:a\n", "project:", "local", "project:a\u0007b"]) assert.equal(skillScopePattern.test(bad), false, JSON.stringify(bad));
});
