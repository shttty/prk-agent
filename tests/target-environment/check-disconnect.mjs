import assert from "node:assert/strict";
import { openProcess } from "@earendil-works/pi-env";
import { setTimeout as delay } from "node:timers/promises";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";

const mode = process.argv[2] ?? "local";
if (mode === "office" && !process.env.PI_TEST_SSH) throw new Error("PI_TEST_SSH required");
const fixture = await createOwnedEnvironment({ remoteCommand: mode === "office" ? process.env.PI_TEST_SSH : undefined });
try {
  const lease = await fixture.acquire(mode === "office" ? "shell" : "local");
  const ready = Promise.withResolvers();
  const processHandle = await openProcess(lease.connection, {
    cwd: fixture.root,
    argv: [mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON, "-u", "-c",
      "import os,time,subprocess;child=subprocess.Popen(['sleep','60']);print(os.getpid(),os.getpgrp(),child.pid,flush=True);time.sleep(60)"],
    onStdout: (bytes) => ready.resolve(Buffer.from(bytes).toString().trim().split(" ").map(Number)),
  });
  const ended = processHandle.exited.catch((error) => error);
  const [pid, pgid, child] = await ready.promise;
  const spawn = fixture.events.find((event) => event.kind === "spawn");
  const disconnectedPid = mode === "office" ? spawn.loginPid : spawn.wrapperPid;
  process.kill(disconnectedPid, "SIGKILL");
  const result = await ended;
  assert.equal(result.code, "unknown", String(result));
  for (let i = 0; !lease.signal.aborted && i < 100; i++) await delay(10);
  assert.equal(lease.signal.aborted, true);
  await assert.rejects(lease.connection.info());
  const spawnCount = fixture.events.filter((event) => event.kind === "spawn").length;
  await delay(200);
  assert.equal(fixture.events.filter((event) => event.kind === "spawn").length, spawnCount);
  let observed;
  for (let i = 0; i < 40; i++) {
    observed = await fixture.observe(`ps -o pid=,ppid=,pgid=,stat= -p ${lease.info.pid} ${pid} ${child}\ntrue\n`);
    if (!observed.trim()) break;
    await delay(50);
  }
  assert.equal(observed.trim(), "", observed);
  console.log(JSON.stringify({ mode, status: "PASS", error: { code: result.code, message: result.message }, ownPids: { daemon: lease.info.pid, pid, pgid, child, disconnectedPid }, observer: observed, events: fixture.events }));
} finally { await fixture.close(); }
