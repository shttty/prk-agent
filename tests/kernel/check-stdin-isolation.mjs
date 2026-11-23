import assert from "node:assert/strict";
import { Type } from "typebox";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";

const mode = process.argv[2] ?? "local";
if (mode === "bun-local") {
  const { checkBunStdinIsolation } = await import("./fixtures/check-bun-stdin-isolation.mjs");
  await checkBunStdinIsolation();
} else {
  await checkPythonStdinIsolation(mode);
}

async function checkPythonStdinIsolation(mode) {
  const target = await createTarget(mode);
  let fixture;
  try {
    fixture = await createSession(target, { tools: [{ name: "stdin_probe", label: "stdin probe", description: "Return an actual SDK callback result.", exposure: "codemode", parameters: Type.Object({}), execute: async () => ({ content: [], structuredContent: 42 }) }] });
    const first = await fixture.run("import os, sys, subprocess\nfrom pathlib import Path\nstdin_pid=os.getpid()\nretained_stdin_value=41\nPath('ordinary_input_module.py').write_text(\"def read_input():\\n try: return input('MODULE_INPUT:')\\n except EOFError: return 'EOF'\\n\")\nimport ordinary_input_module\nassert ordinary_input_module.read_input() == 'EOF'\nassert os.read(0, 128) == b''\nchild=subprocess.run([sys.executable,'-c','import sys; print(repr(sys.stdin.buffer.read()))'],capture_output=True,text=True,timeout=2)\nassert child.returncode == 0 and child.stdout.strip() == \"b''\", child\nassert gateway.stdin_probe() == 42\nprint('CONTROL_READER_RETAINED')");
    assert.equal(first.result.isError, false, first.text);
    assert.match(first.text, /CONTROL_READER_RETAINED/);
    const ordinary = await fixture.run("input('ordinary cell input')");
    assert.equal(ordinary.result.isError, true);
    assert.match(ordinary.text, /unsupported/);
    const next = await fixture.run("assert os.getpid() == stdin_pid\nassert retained_stdin_value == 41\nassert gateway.stdin_probe() == 42\nprint('SAME_PID_AND_NAMESPACE')");
    assert.equal(next.result.isError, false, next.text);
    assert.match(next.text, /SAME_PID_AND_NAMESPACE/);
    console.log(JSON.stringify({ status: "PASS", mode, importedInputEOF: true, inheritedChildStdinEOF: true, callbackAndNamespaceRetained: true }));
  } finally { await fixture?.close(); await target.close(); }
}
