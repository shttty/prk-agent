import assert from "node:assert/strict";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";

const target = await createTarget(process.argv[2] ?? "local");
let scoped, unscoped;
try {
  scoped = await createSession(target, { scoped: true, options: { telemetryIntervalMs: 25 } });
  unscoped = await createSession(target, { hooks: { environment: { PRK_FORCE_UNSCOPED: "1" } }, scoped: true });
  const result = await scoped.run("import os,json,time\nfrom pathlib import Path\nprint('SCOPE_ID='+json.dumps({'pid':os.getpid(),'pgid':os.getpgrp(),'cgroup':Path('/proc/self/cgroup').read_text()}))\nbuffer=bytearray(8*1024*1024)\ntime.sleep(.1)");
  assert.equal(Boolean(result.result.isError), false, result.text);
  const identity = JSON.parse(/SCOPE_ID=(\{[^\n]+\})/.exec(result.text)[1]);
  const memory = scoped.owner.getSnapshot().memory;
  const fallback = await unscoped.run("unscoped_value=99\nprint('UNSCOPED')");
  assert.equal(Boolean(fallback.result.isError), false, fallback.text);
  assert.equal(unscoped.owner.getSnapshot().memory, undefined);
  assert.doesNotMatch(fallback.text, /\[kernel memory /);
  if (memory) {
    assert.match(memory.scope, /prk-kernel-.*\.scope$/);
    assert(memory.current > 0 && memory.workingSet > 0);
    assert.match(result.text.trimEnd().split('\n').at(-1), /^\[kernel memory /);
    assert(identity.cgroup.includes(memory.scope.slice('/sys/fs/cgroup'.length)));
  }
  await scoped.close(); scoped = undefined;
  const observed = await target.observe(`ps -o pid=,pgid=,stat= -p ${identity.pid}\ntrue\n`);
  assert.equal(observed.trim(), '', observed);
  if (memory) {
    const populated = await target.observe(`if test -f '${memory.scope}/cgroup.events'; then cat '${memory.scope}/cgroup.events'; fi\n`);
    assert.doesNotMatch(populated, /populated 1/);
  }
  assert.match((await unscoped.run("unscoped_value")).text, /99/);
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", identity, memory: memory ?? null, scopeSupported: Boolean(memory), unscopedNoFakeSample: true, exited: true }));
} finally { await scoped?.close(); await unscoped?.close(); await target.close(); }
