import assert from "node:assert/strict";
import { test } from "node:test";
import { parseKernelToolCatalog } from "../../../src/codemode/module-catalog/parse-catalog.ts";
import { STATIC_KERNEL_HELPERS } from "../../../src/codemode/module-catalog/cold-catalog.ts";
import { renderKernel } from "../../../src/plugins/kernel/prompt/kernel/render.ts";
import { renderStubs } from "../../../src/plugins/kernel/prompt/kernel/render-stubs.ts";

const point = "class Point(TypedDict):\n    x: int";
const fn = (name, types = {}) => ({ name, signature: "()", description: "", available: true, stub: `def ${name}() -> None: ...`, types });
const input = (over = {}) => ({ helpers: STATIC_KERNEL_HELPERS, toolLibrary: true, autoTools: true, asyncExecution: true, cellTools: true, language: "python",
  kernelCapabilities: () => true, binaryPrompt: () => undefined, ...over });

test("stubs list TypedDicts then defs, each sorted by name, whatever order the kernel reported them in", () => {
  const helpers = [fn("zeta", { Point: point }), fn("alpha", { Zone: "class Zone(TypedDict):\n    y: int", Point: point }), fn("mid")];
  const expected = ["```python", point, "class Zone(TypedDict):\n    y: int", "def alpha() -> None: ...", "def mid() -> None: ...", "def zeta() -> None: ...", "```"].join("\n");
  assert.equal(renderStubs(helpers), expected);
  assert.equal(renderStubs([...helpers].reverse()), expected);
  assert.equal(renderStubs(helpers), renderStubs(helpers.map((helper) => ({ ...helper, types: { ...helper.types } }))));
});

test("a switched-off function takes its stub, and the types only it used, out of the prompt", () => {
  const all = renderKernel(input());
  const withoutEdit = renderKernel(input({ kernelCapabilities: (name) => name !== "edit" }));
  assert.match(all, /^def edit\(/m);
  assert.doesNotMatch(withoutEdit, /def edit\(|class (EditResult|InsertEdit|ReplaceEdit|DiffLine)\b/);
  assert.match(withoutEdit, /^def write\(.*-> WriteResult:$/m);
  assert.match(withoutEdit, /^class ReadLine\(/m);
  assert.doesNotMatch(renderKernel(input({ kernelCapabilities: () => false })), /```python|Helpers run on/);
});

test("the global constraints sit before the stubs and name the reserved package", () => {
  const section = renderKernel(input());
  assert.match(section, /^Helpers run on the target cwd, never on the Gateway\..*`__prk__\.<name>` always reaches the preinstalled function\.$/m);
  assert(section.indexOf("Helpers run on") < section.indexOf("```python"));
});

test("the tool-library hint and the CLI line follow the functions they are about", () => {
  assert.match(renderKernel(input()), /@tool\(persist=True/);
  assert.doesNotMatch(renderKernel(input({ autoTools: false })), /Save a function with/);
  assert.doesNotMatch(renderKernel(input({ kernelCapabilities: (name) => name !== "tool" })), /Save a function with/);
  assert.match(renderKernel(input({ binaryPrompt: () => "CLI line" })), /^CLI line$/m);
  assert.doesNotMatch(renderKernel(input({ binaryPrompt: () => "CLI line", kernelCapabilities: (name) => name !== "tool_bin" })), /CLI line/);
});

test("every cold entry carries a stub, and a catalog report without one is refused", () => {
  assert(STATIC_KERNEL_HELPERS.length > 0 && STATIC_KERNEL_HELPERS.every((helper) => helper.stub?.startsWith(`def ${helper.name}(`)));
  const { stub, ...bare } = fn("x");
  assert.throws(() => parseKernelToolCatalog([bare]), /Invalid kernel tool catalog report/);
  assert.throws(() => parseKernelToolCatalog([{ ...fn("x"), types: { Point: 1 } }]), /Invalid kernel tool catalog report/);
  assert.equal(parseKernelToolCatalog([{ ...bare, moduleOnly: true }]).length, 1);
});
