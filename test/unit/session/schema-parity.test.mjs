import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { schemaToType } from "@earendil-works/pi-codemode/declarations";
import { renderToolStub } from "../../../src/sessions/tool-declarations/python-stubs/render-tool-stub.ts";
import { collectBuiltinTools } from "../../fixtures/schemas/collect-builtin-tools.mjs";
import { EDGE_SCHEMAS } from "../../fixtures/schemas/edge-schemas.mjs";
import { readPiFacts } from "../../fixtures/schemas/read-pi-facts.mjs";
import { readStubFacts } from "../../fixtures/schemas/read-stub-facts.mjs";

// PRK_REAL_TOOLS: a gateway.describe() dump of a real session's tools, for local runs only; it is not part of the repository.
const real = process.env.PRK_REAL_TOOLS ? JSON.parse(readFileSync(process.env.PRK_REAL_TOOLS, "utf8")) : [];
const inputsAndOutputs = (tools) => tools.flatMap((tool) => [[`${tool.name} input`, tool.parameters], ...(tool.outputSchema ? [[`${tool.name} output`, tool.outputSchema]] : [])]);
const CORPUS = [...inputsAndOutputs(collectBuiltinTools()), ...inputsAndOutputs(real), ...EDGE_SCHEMAS.filter(([name]) => !["tags overflow the budget", "too long to render"].includes(name))];
const OVERFLOW = Object.fromEntries(EDGE_SCHEMAS.filter(([name]) => ["tags overflow the budget", "too long to render"].includes(name)));

test("every property, its required/optional state and its constraint tags agree with Pi's schemaToType", () => {
  let facts = 0;
  for (const [name, schema] of CORPUS) {
    const pi = readPiFacts(schemaToType(schema));
    const ours = readStubFacts(schema);
    assert.deepEqual([...ours].sort(), [...pi].sort(), name);
    facts += pi.size;
  }
  assert(facts > 150, `the corpus must exercise properties, saw ${facts}`);
});

test("the corpus covers the cases that differ most between the two renderings", () => {
  const names = EDGE_SCHEMAS.map(([name]) => name).join("|");
  for (const wanted of ["recursive $ref", "anyOf null", "tuple", "allOf of objects", "enum with a float", "additionalProperties", "too long to render"]) assert(names.includes(wanted), wanted);
  assert(CORPUS.length >= 30, `saw ${CORPUS.length} schemas`);
});

test("constraint tags are dropped before a type is given up, as in Pi", () => {
  const tagged = OVERFLOW["tags overflow the budget"];
  const huge = OVERFLOW["too long to render"];
  assert.match(schemaToType(tagged), /@minimum 1/);
  assert.doesNotMatch(schemaToType(tagged, { maxChars: 16_000 }), /@minimum/);
  assert.match(schemaToType(tagged, { maxChars: 16_000 }), /field299\?: number/);
  assert.equal(schemaToType(huge, { maxChars: 16_000 }), "unknown");

  const stub = (parameters) => renderToolStub({ name: "wide", description: "Wide.", parameters }, "summary").def;
  assert.match(stub(tagged), /field299: int = \.\.\./);
  assert.doesNotMatch(stub(tagged), /@minimum/);
  assert.match(stub(huge), /^def wide\(\*\*args: Any\) -> Any:$/m);
  assert.equal(stub(huge).includes("field000"), false);
});
