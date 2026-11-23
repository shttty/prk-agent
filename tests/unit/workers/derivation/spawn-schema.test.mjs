import assert from "node:assert/strict";
import { test } from "node:test";
import { Value } from "typebox/value";
import { createDerivedSessionSchemas } from "../../../../src/plugins/sessions/create-derived-session-schemas.ts";
import { validateOutputSchema } from "../../../../src/sessions/derivation/results/validate-output-schema.ts";

test("spawn accepts only shared-text batches and valid JSON output schemas", () => {
  const schemas = createDerivedSessionSchemas();
  const task = { task: "Inspect one independent input", label: "First input", isolated: true, outputSchema: { type: "object", required: ["count"], properties: { count: { type: "integer" } } } };
  assert.equal(Value.Check(schemas.spawnSchema, { context: "Shared goal and constraints", tasks: [task, { task: "Inspect another input", label: "Second input", isolated: false, outputSchema: true }] }), true);
  assert.equal(Value.Check(schemas.spawnSchema, { context: "Explicit per-task model selection", tasks: [{ ...task, model: "fixture/model", thinkingLevel: "high" }] }), true);
  for (const input of [
    { task: task.task }, { tasks: [task] }, { context: "Shared", tasks: [] },
    { context: "Shared", tasks: [{ ...task, context: "task" }] },
    { context: "Shared", tasks: [{ ...task, forkPoint: "leaf" }] },
    { context: "Shared", tasks: [{ ...task, toolMode: "direct" }] },
    { context: "Shared", tasks: [{ ...task, toolMode: "code" }] },
    { context: "Shared", tasks: [{ task: task.task }] },
    { context: "Shared", tasks: [{ ...task, label: "" }] },
    { context: "Shared", tasks: [{ ...task, isolated: "true" }] },
  ]) assert.equal(Value.Check(schemas.spawnSchema, input), false);
  for (const schema of [true, false, task.outputSchema, { $schema: "http://json-schema.org/draft-07/schema#", anyOf: [{ type: "string" }, { type: "integer" }] }]) validateOutputSchema(schema);
  for (const schema of [{ type: "not-a-type" }, { required: "count" }, { properties: { count: 3 } }, { $schema: "https://unsupported.example/schema" }]) assert.throws(() => validateOutputSchema(schema), /outputSchema/);
});

test("spawn and saved metadata use the renamed lifecycle values without enabling user spawns", () => {
  const schemas = createDerivedSessionSchemas();
  const taskSchema = schemas.spawnSchema.properties.tasks.items;
  assert.deepEqual(taskSchema.properties.lifecycle.anyOf.map(({ const: value }) => value), ["temporary", "persistent"]);
  assert.deepEqual(schemas.infoSchema.properties.lifecycle.anyOf.map(({ const: value }) => value), ["temporary", "persistent", "user"]);
  for (const lifecycle of ["temporary", "persistent"]) {
    assert.equal(Value.Check(schemas.spawnSchema, { context: "Shared lifecycle fixture", tasks: [{ task: "One assignment", label: "Assignment", lifecycle }] }), true);
  }
  assert.equal(Value.Check(schemas.spawnSchema, { context: "Shared lifecycle fixture", tasks: [{ task: "One assignment", label: "Assignment", lifecycle: "user" }] }), false);
});
