import assert from "node:assert/strict";
import test from "node:test";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { createKernelToolDefinition } from "../../../src/plugins/kernel/create-kernel-tool-definition.ts";

const emptyBindings = { inputs: [], outputs: "" };
const prepare = (tool, args) => validateToolArguments(tool, { name: tool.name, arguments: tool.prepareArguments(args) });

for (const mode of ["thread", "isolated"]) {
  test(`kernel_code in ${mode} drops empty bindings before validation`, () => {
    const tool = createKernelToolDefinition("target", true);
    const fields = { code: "print(42)", mode };
    assert.deepEqual(prepare(tool, { ...fields, ...emptyBindings }), fields);
  });
}

test("kernel_code in thread still rejects either nonempty binding", async () => {
  const { tool } = createPythonTool({ target: "target", python: "/python", cwd: "/work", acquire: () => assert.fail("Must reject before acquiring a kernel") });
  for (const bindings of [{ inputs: ["x"], outputs: "" }, { inputs: [], outputs: "y" }]) {
    const args = prepare(tool, { code: "print(42)", mode: "thread", ...bindings });
    await assert.rejects(tool.execute("test", args), { code: "INVALID_REQUEST", message: /require isolated execution/ });
  }
});

test("kernel_code in Bun drops only empty Python bindings", () => {
  const tool = createKernelToolDefinition("target", true, undefined, "bun");
  const fields = { code: "return 42" };
  assert.deepEqual(prepare(tool, { ...fields, ...emptyBindings }), fields);
  for (const nonempty of [{ inputs: ["x"] }, { outputs: "x" }, { mode: "thread" }]) {
    assert.throws(() => prepare(tool, { ...fields, ...emptyBindings, ...nonempty }), { code: "INVALID_REQUEST" });
  }
});
