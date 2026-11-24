import assert from "node:assert/strict";
import test from "node:test";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { manageSchema } from "../../../src/sessions/skill-library/tools/skill-schema.ts";
import { validateSkillChange } from "../../../src/sessions/skill-library/tools/validate-skill-change.ts";
import { validateOperations } from "../../../src/sessions/memory/batches/validate-operations.ts";
import { createManageTool } from "../../../src/plugins/sessions/tools/manage-session.ts";
import { DEFAULT_DERIVED_SCHEMAS } from "../../../src/plugins/sessions/default-schema.ts";
import { createTerminalTools } from "../../../src/plugins/terminals/tools/create-tools.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";

const parse = (tool, args) => validateToolArguments(tool, { name: tool.name, arguments: args });
const skill = { name: "skill_manage", parameters: manageSchema };
const skillChange = (fields) => validateSkillChange(parse(skill, fields));
const without = (fields, key) => Object.fromEntries(Object.entries(fields).filter(([name]) => name !== key));

const create = { scope: "global", description: "Describe it", whenToUse: "When needed", evidence: "Observed", procedure: ["Do it"], pitfalls: [], verification: [] };
for (const [action, fields, extra] of [
  ["create", create, { section: "description" }],
  ["write_file", { path: "notes.md", content: "" }, { section: "description" }],
  ["remove_file", { path: "notes.md" }, { content: "unused" }],
  ["delete", {}, { path: "notes.md" }],
]) {
  test(`skill_manage ${action} takes only its action fields`, () => {
    const request = { action, name: "example-skill", ...fields };
    assert.deepEqual(skillChange(request), request);
    for (const key of Object.keys(fields)) {
      assert.throws(() => skillChange(without(request, key)), new RegExp(`${action} requires: ${key}`));
    }
    assert.throws(() => skillChange(without(request, "name")), /name/);
    assert.throws(() => skillChange({ ...request, ...extra }), new RegExp(`${action} does not accept: ${Object.keys(extra)[0]}`));
  });
}

test("skill_manage create retains declared field lengths and rejects unknown keys", () => {
  const request = { action: "create", name: "example-skill", ...create };
  assert.throws(() => skillChange({ ...request, description: "x".repeat(1025) }), /description/);
  assert.throws(() => skillChange({ ...request, procedure: [] }), /procedure/);
  assert.throws(() => skillChange({ ...request, unknown: true }), /unknown/);
});

for (const [section, value, invalid] of [
  ["description", "a".repeat(1024), "a".repeat(1025)],
  ["whenToUse", "a".repeat(4096), "a".repeat(4097)],
  ["evidence", "a".repeat(8192), "a".repeat(8193)],
  ["procedure", ["run it"], []],
  ["pitfalls", [], ["x".repeat(2049)]],
  ["verification", ["check it"], Array(33).fill("check it")],
  ["scope", "project:example", "project:"],
]) {
  test(`skill_manage patch ${section} applies that section's limits`, () => {
    const request = { action: "patch", name: "example-skill", section, value };
    assert.deepEqual(skillChange(request), request);
    assert.throws(() => skillChange(without(request, "value")), /patch requires: value/);
    assert.throws(() => skillChange(without(request, "section")), /patch requires: section/);
    assert.throws(() => skillChange({ ...request, path: "notes.md" }), /patch does not accept: path/);
    assert.throws(() => skillChange({ ...request, value: invalid }), new RegExp(`patch ${section}: value`));
    assert.throws(() => skillChange({ ...request, value: Array.isArray(value) ? "not an array" : ["not a string"] }), /must be (array|string)/);
  });
}

for (const [action, fields, extra, error] of [
  ["add", { content: "new entry" }, { old_text: "unused" }, /add does not accept old_text/],
  ["replace", { content: "new entry", old_text: "previous entry" }, { text: "unused" }, /Invalid memory request/],
  ["remove", { old_text: "previous entry" }, { content: "unused" }, /remove does not accept content/],
]) {
  test(`memory ${action} requires its fields and rejects extra fields`, () => {
    const operation = { action, target: "user", ...fields };
    assert.deepEqual(validateOperations({ operations: [operation] }), [operation]);
    for (const key of Object.keys(fields)) {
      assert.throws(() => validateOperations({ operations: [without(operation, key)] }), new RegExp(`${action} requires ${key}`));
    }
    assert.throws(() => validateOperations({ operations: [{ ...operation, ...extra }] }), error);
  });
}

test("memory only takes batches and reports the index of an invalid operation", () => {
  const operation = { action: "add", target: "user", content: "  new entry  " };
  assert.deepEqual(validateOperations({ operations: [operation] }), [{ ...operation, content: "new entry" }]);
  assert.throws(() => validateOperations(operation), /non-empty operations/);
  assert.throws(() => validateOperations({ operations: [] }), /non-empty operations/);
  assert.throws(() => validateOperations({ operations: [operation, { target: "user", action: "remove" }] }), /operations\[1\] remove requires old_text/);
  assert.throws(() => validateOperations({ operations: [{ ...operation, content: "one\n§\ntwo" }] }), /content cannot contain the entry delimiter/);
  const request = { v: 1, id: 1, method: "memoryChange" };
  const valid = { ...request, params: { operations: [operation], instance: "here" } };
  assert.deepEqual(validateRequest(valid), valid);
  assert.throws(() => validateRequest({ ...request, params: operation }), /invalid/i);
  assert.throws(() => validateRequest({ ...request, params: { instance: "here" } }), /invalid/i);
});

const session = createManageTool({ schemas: DEFAULT_DERIVED_SCHEMAS });
for (const [action, fields, removed] of [
  ["destroy", {}, "child"],
  ["transfer", { to: "next-owner" }, "child"],
  ["accept", {}, "child"],
  ["project", { project: null }, "session"],
  ["supervisor", {}, "session"],
]) {
  test(`session_manage ${action} uses sessionId alone for its subject`, () => {
    const request = { action, sessionId: "managed-session", ...fields };
    assert.deepEqual(parse(session, request), request);
    for (const key of ["sessionId", ...Object.keys(fields)]) {
      assert.throws(() => parse(session, without(request, key)), /Validation failed for tool "session_manage"/);
    }
    assert.throws(() => parse(session, { ...request, [removed]: request.sessionId }), /Validation failed for tool "session_manage"/);
    assert.throws(() => parse(session, { ...without(request, "sessionId"), [removed]: request.sessionId }), /Validation failed for tool "session_manage"/);
  });
}

const terminals = Object.fromEntries(createTerminalTools(() => {}).map((tool) => [tool.name, tool]));
test("terminal_textsend takes text and only terminal_set accepts the switches", () => {
  const text = { text: "printf hello", name: "main" };
  const switches = { name: "main", quiet_notify: true, output_brake: false };
  assert.deepEqual(parse(terminals.terminal_textsend, text), text);
  assert.deepEqual(parse(terminals.terminal_set, switches), switches);
  assert.deepEqual(parse(terminals.terminal_set, {}), {});
  assert.throws(() => parse(terminals.terminal_textsend, without(text, "text")), /text/);
  for (const key of ["quiet_notify", "output_brake"]) {
    assert.throws(() => parse(terminals.terminal_textsend, { ...text, [key]: switches[key] }), new RegExp(key));
  }
  assert.throws(() => parse(terminals.terminal_set, { ...switches, text: text.text }), /text/);
});
