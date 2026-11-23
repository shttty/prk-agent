import assert from "node:assert/strict";
import { test } from "node:test";
import { appendCatalog } from "../../../../../src/remote-extensions/session-load/catalog/inspect.ts";

test("multi-entry commands accumulate including last empty entry", () => {
  const first = { name: "first_command", description: "Command from the first entry" };
  const second = { name: "second_command", description: "Command from the second entry" };
  const entries = [
    { tools: new Map(), commands: new Map([[first.name, first]]) },
    { tools: new Map(), commands: new Map([[second.name, second]]) },
    { tools: new Map(), commands: new Map() },
  ];
  const catalog = entries.reduce(appendCatalog, { tools: [], commands: [] });
  assert.deepEqual(catalog, { tools: [], commands: [first, second] });
  assert.deepEqual([...entries[0].commands.values()], [first]);
  assert.deepEqual([...entries[1].commands.values()], [second]);
  assert.equal(entries[2].commands.size, 0);
});

test("appendCatalog projects public tool and command metadata in registration order", () => {
  const parameters = { type: "object", properties: { value: { type: "number" } } };
  const first = { name: "first_tool", label: "First", description: "First tool", parameters, toolId: "private-first" };
  const second = { name: "second_tool", label: "Second", description: "Second tool", parameters: { type: "object" } };
  const catalog = appendCatalog({ tools: [], commands: [] }, {
    tools: new Map([["first", { definition: first }], ["second", { definition: second }]]),
    commands: new Map([["first", { name: "first_command", description: "Command", source: "private" }], ["second", { name: "second_command" }]]),
  });
  assert.deepEqual(catalog, {
    tools: [
      { name: "first_tool", label: "First", description: "First tool", parameters },
      { name: "second_tool", label: "Second", description: "Second tool", parameters: { type: "object" } },
    ],
    commands: [{ name: "first_command", description: "Command" }, { name: "second_command", description: undefined }],
  });
  assert.equal(catalog.tools[0].parameters, parameters);
  assert.equal(Object.hasOwn(catalog.tools[0], "toolId"), false);
});

test("appendCatalog leaves earlier metadata and registration inputs unchanged", () => {
  const tool = Object.freeze({ name: "earlier_tool", label: "Earlier", description: "Earlier tool", parameters: {} });
  const command = Object.freeze({ name: "earlier_command", description: "Earlier command" });
  const previous = Object.freeze({ tools: Object.freeze([tool]), commands: Object.freeze([command]) });
  const registration = { tools: new Map(), commands: new Map([["next", Object.freeze({ name: "next_command" })]]) };
  const catalog = appendCatalog(previous, registration);
  assert.deepEqual(previous, { tools: [tool], commands: [command] });
  assert.deepEqual(catalog.commands, [command, { name: "next_command", description: undefined }]);
  assert.deepEqual(catalog.tools, [tool]);
  assert.notEqual(catalog.commands, previous.commands);
  assert.deepEqual([...registration.commands.values()], [{ name: "next_command" }]);
});

test("appendCatalog appends tools with colliding names rather than silently reordering or deduplicating", () => {
  const first = { name: "shared", label: "First", description: "First entry", parameters: {} };
  const second = { ...first, label: "Second", description: "Second entry" };
  const catalog = [first, second].reduce((previous, definition) => appendCatalog(previous, {
    tools: new Map([[definition.name, { definition }]]), commands: new Map(),
  }), { tools: [], commands: [] });
  assert.deepEqual(catalog.tools, [first, second]);
});
