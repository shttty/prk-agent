import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeStubs } from "../../../src/sessions/tool-declarations/python-stubs/merge-stubs.ts";
import { renderToolStub } from "../../../src/sessions/tool-declarations/python-stubs/render-tool-stub.ts";
import { STATIC_KERNEL_HELPERS } from "../../../src/codemode/module-catalog/cold-catalog.ts";
import { collectBuiltinTools } from "../../fixtures/schemas/collect-builtin-tools.mjs";
import { EDGE_SCHEMAS } from "../../fixtures/schemas/edge-schemas.mjs";

const Q3 = '"'.repeat(3);
const edge = Object.fromEntries(EDGE_SCHEMAS);
const render = (parameters, rest = {}, detail = "summary") => mergeStubs([renderToolStub({ name: "probe", description: "Probe tool.", parameters, ...rest }, detail)]).text;
const object = (properties, required = []) => ({ type: "object", properties, required });

test("arguments become keyword parameters, inline objects named TypedDicts, optional fields NotRequired, the result a TypedDict", () => {
  const text = render(
    object({ query: { type: "string", description: "What to look for" }, scope: { type: "object", properties: { depth: { type: "integer", minimum: 1 } } }, tags: { type: "array", items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } }, ["query"]),
    { outputSchema: object({ hits: { type: "array", items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } }, ["hits"]) });
  assert.equal(text, [
    "class ProbeArgsScope(TypedDict):", "    # @integer @minimum 1", "    depth: NotRequired[int]",
    "class ProbeArgsTagsItem(TypedDict):", "    name: str",
    "class ProbeOutput(TypedDict):", "    hits: list[ProbeOutputHitsItem]",
    "class ProbeOutputHitsItem(TypedDict):", "    id: str",
    "def probe(", "    *,", "    # What to look for", "    query: str,", "    scope: ProbeArgsScope = ...,", "    tags: list[ProbeArgsTagsItem] = ...,", ") -> ProbeOutput:", `    ${Q3}Probe tool.${Q3}`,
  ].join("\n"));
});

test("a tool without outputSchema returns Any and one without arguments takes none", () => {
  assert.equal(render({ type: "object", properties: {}, additionalProperties: false }), `def probe() -> Any:\n    ${Q3}Probe tool.${Q3}`);
  assert.equal(render(undefined), `def probe(**args: Any) -> Any:\n    ${Q3}Probe tool.${Q3}`);
});

test("enum and const are Literal only for str, int, bool and None; any other value makes the whole type Any", () => {
  const text = render(edge["enum with a float"]);
  assert.match(text, /flag: Literal\[True\] = \.\.\./);
  assert.match(text, /level: Literal\[1, 2, 3\] = \.\.\./);
  assert.match(text, /mode: Literal\['fast', 'slow', None\] = \.\.\./);
  assert.match(text, /ratio: Any = \.\.\./);
  assert.match(text, /shape: Any = \.\.\./);
});

test("anyOf is a union with None last, and one Literal for alternatives that are all constants", () => {
  const text = render(object({ limit: { anyOf: [{ type: "null" }, { type: "integer" }] }, kind: { anyOf: [{ const: "a" }, { const: "b" }, { type: "boolean" }] } }));
  assert.match(text, /kind: Literal\['a', 'b'\] \| bool = \.\.\./);
  assert.match(text, /limit: int \| None = \.\.\./);
});

test("additionalProperties: a dict for a bare map, **extra at the top, a dict with a note when fixed fields come with other keys", () => {
  const nested = render(edge.additionalProperties);
  assert.match(nested, /env: dict\[str, str\] = \.\.\./);
  assert.match(nested, /tags: dict\[str, Any\] = \.\.\./);
  assert.match(nested, /# fixed keys: id, note \(optional\); other keys: int\n    mixed: dict\[str, Any\] = \.\.\./);
  assert.match(nested, /class ProbeArgsClosed\(TypedDict\):\n    \.\.\./);
  assert.equal(render(edge["top level open object"]), `def probe(*, id: str, **extra: str) -> Any:\n    ${Q3}Probe tool.${Q3}`);
});

test("allOf of objects merges their fields; any other allOf is Any", () => {
  const text = render(edge["allOf of objects"]);
  assert.match(text, /^    by: str,$/m);
  assert.match(text, /^    # @minLength 1\n    id: str,$/m);
  assert.match(text, /^    at: str = \.\.\.,$/m);
  assert.match(render(edge["allOf with a non-object"]), /name: Any = \.\.\./);
  assert.match(render({ allOf: [object({ a: { type: "string" } }), object({ a: { type: "integer" } })] }), /a: Any = \.\.\./);
});

test("recursive and unresolvable references are Any, and a shared definition is expanded where it is used", () => {
  assert.match(render(edge["recursive $ref"]), /children: list\[Any\] = \.\.\./);
  assert.match(render(edge["remote and dangling $ref"]), /a: Any = \.\.\., b: Any = \.\.\./);
  const shared = render(edge["shared $ref used twice"]);
  assert.match(shared, /class ProbeArgsFrom\(TypedDict\)/);
  assert.match(shared, /class ProbeArgsTo\(TypedDict\)/);
});

test("property names that are not Python names use the functional TypedDict and Unpack", () => {
  const text = render(edge["property names that are not Python names"]);
  assert.match(text, /^ProbeArgs = TypedDict\('ProbeArgs', \{$/m);
  assert.match(text, /^    'from': NotRequired\[str\],$/m);
  assert.match(text, /^def probe\(\*\*args: Unpack\[ProbeArgs\]\) -> Any:$/m);
});

test("a top-level union of objects stays one **args parameter that lists the shapes", () => {
  const text = render({ anyOf: [object({ action: { const: "a" } }, ["action"]), object({ action: { const: "b" }, id: { type: "string" } }, ["action", "id"])] });
  assert.match(text, /# keyword arguments of exactly one of these shapes\n    \*\*args: ProbeArgsVariant1 \| ProbeArgsVariant2,/);
  assert.match(text, /class ProbeArgsVariant2\(TypedDict\):\n    action: Literal\['b'\]\n    id: str/);
});

test("the docstring is the first paragraph; describe(name) keeps every paragraph; guidelines follow, and the stub stays valid Python text", () => {
  const description = `First line\nstill the first paragraph.\n\nSecond paragraph with \\d and ${Q3}quotes${Q3}.`;
  const summary = render(undefined, { description, promptGuidelines: ["Prefer  this over that", "  "] });
  assert.match(summary, /"""First line still the first paragraph\.\n\n    - Prefer this over that"""/);
  const full = render(undefined, { description, promptGuidelines: ["Use it"] }, "full");
  assert.match(full, /"""First line\n    still the first paragraph\.\n\n    Second paragraph with \\\\d and '''quotes'''\.\n\n    - Use it"""/);
  assert.match(render(undefined, { description: 'Ends with a quote"' }), new RegExp(`${Q3}Ends with a quote\\\\"${Q3}`));
});

test("TypedDicts two tools define differently cannot share one block: the later tool is left out", () => {
  const first = { name: "a", classes: new Map([["AArgsX", "class AArgsX(TypedDict):\n    x: str"]]), def: "def a() -> Any: ..." };
  const clash = { name: "b", classes: new Map([["AArgsX", "class AArgsX(TypedDict):\n    other: int"]]), def: "def b() -> Any: ..." };
  const merged = mergeStubs([first, clash]);
  assert.deepEqual(merged.dropped, ["b"]);
  assert.doesNotMatch(merged.text, /def b/);
  assert.match(merged.text, /def a/);
});

test("generated TypedDict names carry the tool's name and an Args/Output marker, so they never equal a kernel TypedDict name", () => {
  const kernelTypes = new Set(STATIC_KERNEL_HELPERS.flatMap(({ types }) => Object.keys(types ?? {})));
  assert(kernelTypes.size > 8 && kernelTypes.has("ReadResult"));
  const tools = [...collectBuiltinTools(), ...EDGE_SCHEMAS.map(([name, parameters]) => ({ name: name.replace(/\W+/g, "_"), description: "Edge.", parameters })),
    ...["read", "grep", "edit", "write", "ls", "glob", "bash", "disk_usage", "read_line", "diff_line"].map((name) => ({ name, description: "Kernel-like name.", parameters: object({ a: object({ b: { type: "string" } }) }), outputSchema: object({ c: object({}) }) }))];
  const generated = tools.flatMap((item) => [...renderToolStub(item, "summary").classes.keys()]);
  assert(generated.length > 40, `saw ${generated.length} classes`);
  assert.deepEqual(generated.filter((name) => kernelTypes.has(name)), []);
  assert(generated.every((name) => /^[A-Z][A-Za-z0-9]*(Args|Output)/.test(name)), generated.filter((name) => !/(Args|Output)/.test(name)).join());
});
