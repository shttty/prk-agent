import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

// These sockets carry only test readiness, release, and EOF evidence, never kernel control.
export async function openIsolatedStopWitness({ tempRoot, onCleanup }, until) {
  const path = join(tempRoot, "wait.sock");
  const peers = new Set();
  const server = createServer((socket) => {
    const peer = { socket, header: "" };
    peers.add(peer);
    socket.setEncoding("utf8");
    socket.on("error", (error) => { peer.error = error; });
    socket.on("data", (chunk) => { peer.header += chunk; });
  });
  server.listen(path);
  await once(server, "listening");
  onCleanup(async () => {
    for (const { socket } of peers) socket.destroy();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  return {
    code(name, { setup = "", after = "", descendant = false } = {}) {
      return `import json, os, socket, subprocess, sys
from pathlib import Path
def wait_identity(pid):
    fields = Path('/proc/%d/stat' % pid).read_text().rsplit(') ', 1)[1].split()
    return {'pid': pid, 'startTime': fields[19]}
${setup}
with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stop_wait_socket:
    stop_wait_socket.connect(${JSON.stringify(path)})
    stop_wait_child = None
${descendant ? `    stop_wait_child = subprocess.Popen([sys.executable, '-I', '-c', ${JSON.stringify(holdSocket)}, str(stop_wait_socket.fileno())],
                                       pass_fds=(stop_wait_socket.fileno(),), stdout=subprocess.PIPE)
    assert stop_wait_child.stdout.readline() == b'ready\\n'
` : ""}    ready = {'name': ${JSON.stringify(name)}, 'leader': wait_identity(os.getpid()),
             'child': wait_identity(stop_wait_child.pid) if stop_wait_child else None}
    stop_wait_socket.sendall((json.dumps(ready) + '\\n').encode())
    assert stop_wait_socket.recv(1) == b'!', 'fixture closed without releasing the cell'
${after}`;
    },
    async peer(name) {
      return until(() => {
        for (const peer of peers) {
          assert.ifError(peer.error);
          if (!peer.header.endsWith("\n")) continue;
          const ready = JSON.parse(peer.header);
          if (ready.name === name) return { ...ready, socket: peer.socket };
        }
      }, `${name} reached the native socket wait`);
    },
  };
}

// This real descendant retains A's connected fd. A-only exit cannot produce peer EOF.
// Closing the fixture also wakes this process if the test fails before a successful stop.
const holdSocket = `import select, sys
poller = select.poll()
poller.register(int(sys.argv[1]), select.POLLHUP | select.POLLERR)
print('ready', flush=True)
poller.poll(90000)`;

export function readProc(pid) {
  assert(Number.isSafeInteger(pid) && pid > 1, `invalid fixture PID ${pid}`);
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(/\s+/);
    return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]), startTime: fields[19] };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return undefined;
    throw error;
  }
}

export function ownedProc({ pid, startTime }) {
  const current = readProc(pid);
  return current?.startTime === startTime ? current : undefined;
}

export async function withFrozenRunner(runner, until, exercise) {
  const current = ownedProc(runner);
  assert(current && /^[RS]$/.test(current.state), "SIGSTOP requires the live runner from this fixture");
  process.kill(runner.pid, "SIGSTOP");
  try {
    await until(() => ownedProc(runner)?.state === "T", "owned runner entered SIGSTOP");
    await exercise();
  } finally {
    const stopped = ownedProc(runner);
    if (stopped && !/^[ZX]$/.test(stopped.state)) {
      try { process.kill(runner.pid, "SIGCONT"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
}
