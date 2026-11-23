import assert from "node:assert/strict";
import { Type } from "typebox";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";
import { checkPythonModeMatrix } from "./fixtures/check-python-mode-matrix.mjs";
import { until } from "./fixtures/create-yielded-sdk-cell.mjs";

const target = await createTarget(process.argv[2] ?? "local");
const callbacks = [null, false, 0, "literal {json}"].map((value, i) => ({
  name: `value_${i}`, label: `value_${i}`, description: "Return a controlled native value.", exposure: "codemode", parameters: Type.Object({}),
  execute: async () => ({ content: [{ type: "text", text: "wrong textual fallback" }], structuredContent: value }),
}));
let first, second;
try {
  if (target.local) await checkPythonModeMatrix(target);
  first = await createSession(target, { tools: callbacks });
  second = await createSession(target);
  const run = async (code, failure = false) => {
    const value = await first.run(code);
    assert.equal(Boolean(value.result.isError), failure, value.text);
    return value;
  };
  await run("x=41");
  assert.match((await run("x+1")).text, /42/);
  assert.match((await run("import asyncio\nawait asyncio.sleep(0)\nx")).text, /41/);
  assert.equal((await second.run("'x' in globals()")).result.isError, false);
  assert.match((await second.run("'x' in globals()")).text, /False/);
  await run("if broken syntax", true);
  await run("raise ValueError('owned failure')", true);
  assert.match((await run("x")).text, /41/);
  await run("assert gateway.value_0() is None\nassert gateway.value_1() is False\nassert gateway.value_2() == 0\nassert gateway.value_3() == 'literal {json}'");
  assert(first.events.some((event) => event.type === "tool_execution_start" && event.parentToolCallId), "real SDK nested execution event");
  const output = await run("import os,sys,subprocess,ctypes\nprint('PRINT')\nos.write(1,b'RAW\\n')\nctypes.CDLL(None).puts(b'C_OUTPUT')\nctypes.CDLL(None).fflush(None)\nsubprocess.run([sys.executable,'-c',\"print('CHILD_OUTPUT')\"])\nprint('β😀')");
  for (const text of ["PRINT", "β😀"]) assert(output.text.includes(text), output.text);
  const rawOutput = ["RAW", "C_OUTPUT", "CHILD_OUTPUT"];
  for (const text of rawOutput) assert(!output.text.includes(text), output.text);
  const expectedDiagnostics = rawOutput.join("\n") + "\n";
  await until(() => first.owner.getSnapshot().diagnostics?.stdout === expectedDiagnostics, "unowned fd output reaches diagnostics only");
  await run("class NoRepr:\n def __repr__(self): raise RuntimeError('REPR_SIDE_EFFECT')\nobj=NoRepr()");
  assert(first.owner.variables().variables.some(({ name }) => name === "obj"));
  await assert.rejects(first.owner.deleteVariable("x;print('bad')"));
  await first.owner.deleteVariable("obj");
  assert(!first.owner.variables().variables.some(({ name }) => name === "obj"));
  const identity = first.owner.getSnapshot().kernelId;
  await first.owner.clear();
  assert.equal(first.owner.getSnapshot().kernelId, identity);
  assert.match((await run("'x' in globals()")).text, /False/);
  await first.owner.restart();
  assert.notEqual(first.owner.getSnapshot().kernelId, identity);
  await run("assert gateway.value_2() == 0");
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", root: target.root, python: target.python, kernel: first.owner.getSnapshot() }));
} finally {
  await first?.close();
  await second?.close();
  await target.close();
}
