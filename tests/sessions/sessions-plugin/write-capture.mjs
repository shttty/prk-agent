import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeCapture(directory, name, request) {
  assert.equal(typeof request.wire, "string", "Capture must include the real HTTP request body");
  const tools = JSON.stringify(request.tools);
  assert(request.wire.includes(`"tools":${tools}`), "Tool artifact must preserve the exact HTTP declaration bytes and order");
  assert(request.wire.includes(`"content":${JSON.stringify(request.instructions)}`), "Instructions must occur verbatim in the serialized HTTP request");
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, `${name}.http.json`), request.wire),
    writeFile(join(directory, `${name}.instructions.txt`), request.instructions),
    writeFile(join(directory, `${name}.tools.json`), tools),
  ]);
}
