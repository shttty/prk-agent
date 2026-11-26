import assert from "node:assert/strict";
import { text } from "../gateway/assemble-gateway.mjs";

// write/read/edit/grep are SDK kernel-tool modules that publish an operation trace before touching the file.
const code = (name) => `import os
_path = os.path.join(os.getcwd(), ${JSON.stringify(name)})
write(_path, "alpha\\n")
_ref = read(_path)["lines"][0]["ref"]
edit(_path, [{"op": "replace", "start": _ref, "end": _ref, "text": "beta"}])
print("file helpers:", read(_path)["lines"][0]["text"], grep("beta", _path)["matches"])`;

export async function verifyFileHelpers(f, sessionId, name, args = {}) {
  const receipt = await f.send(sessionId, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code: code(name), ...args } })}`);
  assert.equal((await f.complete(sessionId, receipt)).status, "completed");
  const result = text(f.state(sessionId).messages.findLast((message) => message.role === "toolResult"));
  assert.match(result, /^file helpers: beta 1$/m, result);
}
