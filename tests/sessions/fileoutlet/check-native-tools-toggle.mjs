import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkNativeToolsToggle({ remote, native, invoke, assertDeclared, backingCwd, gatewayCwd, targetCwd, exists, kernel, text, proof, fileNames }) {
  await native(remote, "local-tools", { enabled: true });
  await native(remote, "reload");
  const directWrite = await invoke(remote, "write", { path: "direct.txt", content: "DIRECT_INITIAL\n" });
  assertDeclared(directWrite.declarations, true);
  assert.equal(await readFile(join(backingCwd, "direct.txt"), "utf8"), "DIRECT_INITIAL\n");
  const directRead = await invoke(remote, "read", { path: "direct.txt", offset: 1, limit: 1 });
  assertDeclared(directRead.declarations, true);
  assert.match(text(directRead.result), /DIRECT_INITIAL/);
  const directEdit = await invoke(remote, "edit", { path: "direct.txt", edits: [{ oldText: "DIRECT_INITIAL", newText: "DIRECT_EDITED" }] });
  assertDeclared(directEdit.declarations, true);
  assert.equal(await readFile(join(backingCwd, "direct.txt"), "utf8"), "DIRECT_EDITED\n");
  assert.equal(await readFile(join(gatewayCwd, "direct.txt"), "utf8"), "GATEWAY_SENTINEL\n", "Native file tools must not operate on the Gateway cwd");
  assert.equal(await exists(`${targetCwd}/direct.txt`), false, "The actual target path remains unavailable in the Gateway namespace");
  await native(remote, "local-tools", { enabled: false });
  await native(remote, "reload");
  const off = await kernel('print(read("direct.txt", limit=1))');
  assertDeclared(off.declarations, false);
  assert.match(text(off.result), /DIRECT_EDITED/);
  proof("remote-native-tools-toggle", { names: fileNames, enabledDeclarations: directWrite.declarations[0], disabledDeclarations: off.declarations[0], gatewaySentinelUnchanged: true });
}
