import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { openProcess } from "@earendil-works/pi-env";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";

const mode = process.argv[2] ?? "local";
const fixture = await createOwnedEnvironment({ remoteCommand: mode === "office" ? process.env.PI_TEST_SSH : undefined });
if (mode === "office" && !process.env.PI_TEST_SSH) throw new Error("PI_TEST_SSH required for office");
const id = mode === "local" ? "local" : "shell";
try {
  const [first, second] = await Promise.all([fixture.acquire(id), fixture.acquire(id)]);
  assert.equal(first.connection, second.connection);
  assert.equal(first.generation, second.generation);
  assert.equal(first.info.version, "1.6.0");
  assert.equal(first.info.protocol, 1);
  const stdout = [];
  const child = await openProcess(first.connection, {
    cwd: fixture.root,
    argv: [mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON, "-u", "-c",
      "import os,sys;sys.stderr.write(str((os.getuid(),os.getcwd(),sys.platform))+'\\n');sys.stderr.flush();sys.stdout.buffer.write(sys.stdin.buffer.read());sys.stdout.buffer.flush()"],
    onStdout: (bytes) => stdout.push(Buffer.from(bytes)),
    onStderr: (bytes) => console.log(JSON.stringify({ kind: "identity", text: Buffer.from(bytes).toString() })),
  });
  await first.release();
  assert.equal(second.signal.aborted, false);
  const payload = Buffer.concat([Buffer.from(Array.from({ length: 256 }, (_, i) => i)), Buffer.from("\r\n~.\r\n")]);
  child.write(payload);
  child.closeStdin();
  assert.equal(await child.exited, 0);
  assert.deepEqual(Buffer.concat(stdout), payload);
  const daemonPid = first.info.pid;
  await second.release();
  for (let i = 0; i < 30; i++) {
    const state = await fixture.observe(`ps -o pid=,ppid=,pgid=,stat= -p ${daemonPid} ${child.pid}\ntrue\n`);
    if (!state.trim()) break;
    if (i === 29) assert.fail(`Owned processes remain: ${state}`);
    await delay(50);
  }
  const next = await fixture.acquire(id);
  assert.notEqual(next.generation, first.generation);
  assert.notEqual(next.info.pid, daemonPid);
  if (id === "shell") {
    assert.deepEqual(fixture.events.filter((event) => event.kind === "deployment").map((event) => event.cached), [false, true]);
  }
  await next.release();
  if (id === "shell") assert.ok(fixture.events.filter((event) => event.kind === "gate").every((event) => event.queuedBytes >= 40));
  console.log(JSON.stringify({ mode, status: "PASS", hello: first.info, binaryBytes: payload.length, exitedPids: [daemonPid, child.pid], events: fixture.events }));
} finally { await fixture.close(); }
