import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { decode } from "../../../src/remote-extensions/codec/decode.mjs";
import { encode } from "../../../src/remote-extensions/codec/encode.mjs";

async function within(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function withHost(runtime, directory, signalFile, consume) {
  const server = createServer();
  const socketPath = join(directory, "ipc");
  server.listen(socketPath);
  await once(server, "listening");
  const connected = once(server, "connection");
  const unit = `prk-import-test-${randomUUID()}.scope`;
  const child = spawn("systemd-run", ["--user", "--scope", "--quiet", `--unit=${unit}`,
    "--property=MemoryMax=1073741824", "--property=MemorySwapMax=0", "--property=OOMPolicy=continue",
    process.env.PI_TEST_PYTHON, "-c", `import os, sys
env = dict(os.environ)
with open("/proc/self/cgroup") as source:
    env["PRK_EXT_SCOPE_PATH"] = "/sys/fs/cgroup" + source.read().strip().split("::", 1)[1]
os.execve(sys.argv[1], sys.argv[1:], env)`, runtime, join(directory, "host/host.mjs")], {
    cwd: directory, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HOME: join(directory, "home"), PI_OFFLINE: "1", SHELL: "/bin/bash", PRK_TEST_ROOT_SIGNAL: signalFile, PRK_EXT_SOCKET: socketPath },
  });
  let logs = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk).slice(-16_000); });
  const closed = once(child, "close");
  let socket, request;
  const pending = new Map();
  try {
    [socket] = await within(Promise.race([connected, closed.then(([code, signal]) => {
      throw new Error(`Scoped host did not connect (${code ?? signal}): ${logs}`);
    })]), "owned scoped host connection (requires a systemd user manager and cgroup-v2 memory)");
    const lines = createInterface({ input: socket, crlfDelay: Infinity });
    lines.on("line", (line) => {
      const frame = JSON.parse(line);
      if (frame.kind !== "reply") return;
      const call = pending.get(frame.id);
      if (!call) return;
      if (Object.hasOwn(frame, "error")) call.reject(decode(frame.error));
      else call.resolve(decode(frame.result));
    });
    socket.on("error", (error) => { for (const call of pending.values()) call.reject(error); });
    socket.on("close", () => { for (const call of pending.values()) call.reject(new Error(`Owned host socket closed: ${logs}`)); });
    let sequence = 0;
    request = (method, payload) => {
      const id = `test:${++sequence}`;
      const result = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.write(`${JSON.stringify({ kind: "request", id, method, payload: encode(payload) })}\n`);
      });
      return within(result, `host ${method}: ${logs}`).finally(() => pending.delete(id));
    };
    await consume(request);
    assert.deepEqual(await request("shutdown", { reason: "quit" }), { stopped: true });
    request = undefined;
    const [code, signal] = await within(closed, "owned host shutdown");
    assert.equal(code, 0, `Owned host exited on ${signal}: ${logs}`);
  } finally {
    if (request && !socket.destroyed) await request("shutdown", { reason: "quit" }).catch(() => {});
    socket?.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      await promisify(execFile)("systemctl", ["--user", "stop", unit], { timeout: 5_000 }).catch(() => {});
      child.kill("SIGKILL");
    }
    await within(closed, "owned scope cleanup");
    await new Promise((resolve) => server.close(resolve));
  }
}
