import assert from "node:assert/strict";
import { test } from "node:test";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";

const NOTICE = /^\[PRK\] /m;

test("preinstalled functions live in __prk__; a shadowed global is announced once and never silently restored", async (t) => {
  const f = await gatewayFixture(t);
  await f.stageArtifacts();
  const id = await f.create();
  const cell = async (code, extra = {}) => {
    const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code, ...extra } })}`);
    assert.equal((await f.complete(id, receipt)).status, "completed");
    return text(f.state(id).messages.findLast((message) => message.role === "toolResult"));
  };

  const intact = await cell(`import sys
names = ["read", "write", "edit", "grep", "glob", "ls", "bash", "phase", "tool", "library_sync", "tool_bin", "disk_usage", "gateway"]
print("MODULE", sys.modules["__prk__"] is __prk__, all(globals()[name] is getattr(__prk__, name) for name in names))
from __prk__ import read as again
print("IMPORT", again is read)`);
  assert.match(intact, /^MODULE True True$/m, intact);
  assert.match(intact, /^IMPORT True$/m, intact);
  assert.doesNotMatch(intact, NOTICE, "an untouched namespace gets no notice");

  const shadowed = await cell("import glob\nprint('MODULE_GLOB', hasattr(glob, 'glob'))");
  assert.match(shadowed, /^MODULE_GLOB True$/m, shadowed);
  assert.match(shadowed, /^\[PRK\] `glob` was overwritten or deleted; the preinstalled function is still `__prk__\.glob\(\.\.\.\)`\.$/m, shadowed);
  assert(shadowed.lastIndexOf("[PRK]") > shadowed.indexOf("MODULE_GLOB"), "the notice closes the cell's output");

  const usable = await cell("print('KEYS', sorted(__prk__.glob('*', '.')))");
  assert.match(usable, /^KEYS \['files', 'limit_reached', 'output_limited', 'truncated'\]$/m, usable);
  assert.doesNotMatch(usable, NOTICE, "the same overwrite is announced once");

  const restored = await cell("from __prk__ import glob\nprint('BACK', glob is __prk__.glob)");
  assert.match(restored, /^BACK True$/m);
  assert.doesNotMatch(restored, NOTICE);
  assert.match(await cell("import glob"), NOTICE, "a new overwrite is announced again");

  const deleted = await cell("import os\nPATH = os.path.join(os.getcwd(), 'a.txt')\n__prk__.write(PATH, 'alpha\\n')\ndel read");
  assert.match(deleted, /`read` was overwritten or deleted/, deleted);
  assert.match(await cell("print('LINE', __prk__.read(PATH)['lines'][0]['text'])"), /^LINE alpha$/m);
  assert.doesNotMatch(await cell("from __prk__ import read\nprint('READ', read is __prk__.read)"), NOTICE);

  const many = await cell("bash = 1\nls = 2");
  assert.match(many, /^\[PRK\] `bash`, `ls` were overwritten or deleted; the preinstalled functions are still `__prk__\.<name>\(\.\.\.\)`\.$/m, many);

  await cell("KEEP = 41");
  assert.equal((await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "reload", args: {} })).status, "completed");
  const reloaded = await cell("print('RELOAD', KEEP, bash is __prk__.bash, ls is __prk__.ls)");
  assert.match(reloaded, /^RELOAD 41 False False$/m, "a same-process reload keeps variables and does not put the overwritten aliases back");
  assert.doesNotMatch(reloaded, NOTICE);

  const reset = await cell("print('RESET', glob is __prk__.glob, callable(bash), callable(ls), callable(read))", { reset: true });
  assert.match(reset, /^RESET True True True True$/m, reset);
  assert.doesNotMatch(reset, NOTICE, "a restarted kernel has every alias again");
});
