import assert from "node:assert/strict";
import { test } from "node:test";
import { schemaMetadata } from "../../../../../src/remote-extensions/registration/metadata/validate-schema-metadata.mjs";

test("schemaMetadata accepts JSON Schema types and nullable unions without retaining input identity", () => {
  for (const type of ["null", "boolean", "object", "array", "number", "string", "integer", ["string", "null"]]) {
    const schema = { type };
    const result = schemaMetadata(schema, "probe.parameters");
    assert.deepEqual(result, schema);
    assert.notEqual(result, schema);
  }
});

test("schemaMetadata accepts nested schemas and preserves annotation data", () => {
  const schema = {
    type: "object",
    properties: { label: { type: "string", default: "中文" }, values: { type: "array", items: { type: "number" } } },
    required: ["label"], additionalProperties: false,
    $defs: { count: { type: "integer" } },
    anyOf: [{ required: ["label"] }, false],
    dependencies: { label: ["values"], values: { properties: { label: { type: "string" } } } },
    examples: [{ label: "example", values: [1, 2] }],
  };
  assert.deepEqual(schemaMetadata(schema, "probe.parameters"), schema);
});

test("schemaMetadata requires an object root and rejects non-JSON metadata", () => {
  for (const value of [null, false, true, [], "string", 1]) {
    assert.throws(() => schemaMetadata(value, "probe.parameters"), /probe\.parameters must be a JSON Schema object/);
  }
  assert.throws(() => schemaMetadata({ default: undefined }, "probe.parameters"), /probe\.parameters must be JSON-only/);
});

test("schemaMetadata rejects unsupported or empty JSON Schema type declarations", () => {
  for (const type of ["undefined", "Date", "constructor", "__proto__", [], ["string", "undefined"], ["string", 1], null, {}]) {
    assert.throws(() => schemaMetadata({ type }, "probe.parameters"), /probe\.parameters contains a non-JSON Schema type/);
  }
});

test("schemaMetadata validates every supported nested schema position", () => {
  for (const key of ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"]) {
    assert.throws(() => schemaMetadata({ [key]: { child: { type: "undefined" } } }, "probe.parameters"), /non-JSON Schema type/, key);
  }
  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    assert.throws(() => schemaMetadata({ [key]: [{ type: "undefined" }] }, "probe.parameters"), /non-JSON Schema type/, key);
    assert.throws(() => schemaMetadata({ [key]: {} }, "probe.parameters"), new RegExp(`probe\\.parameters\\.${key} must be an array`));
  }
  for (const key of ["items", "additionalItems", "additionalProperties", "unevaluatedItems", "unevaluatedProperties", "propertyNames", "contains", "not", "if", "then", "else", "contentSchema"]) {
    assert.throws(() => schemaMetadata({ [key]: { type: "undefined" } }, "probe.parameters"), /non-JSON Schema type/, key);
    assert.throws(() => schemaMetadata({ [key]: 1 }, "probe.parameters"), /contains a non-schema value/, key);
  }
  assert.throws(() => schemaMetadata({ dependencies: { child: { type: "undefined" } } }, "probe.parameters"), /non-JSON Schema type/);
});
