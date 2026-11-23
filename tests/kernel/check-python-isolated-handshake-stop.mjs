import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const kernel = new URL("../../src/kernel/", import.meta.url);
const source = String.raw`
import array
import json
import os
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from contextlib import ExitStack


def run_kernel(configuration):
    generation = configuration["generation"]
    def external(packet, sent=None):
        with socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET) as control:
            control.settimeout(3)
            control.connect("\0prk-fork-" + generation)
            control.send(json.dumps(packet).encode())
            if sent:
                sent.set()
            try:
                raw = control.recv(4096)
            except ConnectionResetError:
                raw = b""
            return json.loads(raw) if raw else None

    with ExitStack() as stack:
        def fork(cell_id):
            status, child_status = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
            data, child_data = socket.socketpair()
            stack.enter_context(status).settimeout(3)
            stack.enter_context(data).settimeout(3)
            with child_status, child_data:
                packet = dict(kind="fork", generation=generation, cellId=cell_id)
                fds = array.array("i", [child_status.fileno(), child_data.fileno()])
                forkserver.sendmsg([json.dumps(packet).encode()], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, fds)])
            return status, data

        sibling, _ = fork("sibling")
        live = json.loads(sibling.recv(4096))
        assert live["kind"] == "forked", live
        cancel = dict(kind="cancel", generation=generation, cellId="pending-cell")
        assert external(dict(cancel, generation="stale")) is None
        assert external(dict(cancel, pgid=live["pgid"])) is None
        assert external(dict(cancel, pid=live["pid"])) is None
        assert external(dict(cancel, cellId="sibling", pgid=live["pgid"])) is None
        assert external(cancel) == dict(status="pending", generation=generation, cellId="pending-cell")
        status, data = fork("pending-cell")
        assert json.loads(status.recv(4096)) == dict(kind="cancelled", generation=generation, cellId="pending-cell")
        assert data.recv(1) == b"", "a cancelled pre-handshake request gets no child data peer"
        assert os.getpgid(live["pid"]) == live["pgid"], "unrelated registered group remains owned and live"

        Path("delay-handshake").touch()
        status, data = fork("handshake-in-flight")
        for _ in range(600):
            if Path("at-fork-child").exists():
                break
            time.sleep(.005)
        assert Path("at-fork-child").exists()
        cancel = dict(kind="cancel", generation=generation, cellId="handshake-in-flight")
        with ThreadPoolExecutor(max_workers=1) as executor:
            sent = threading.Event()
            interrupted = executor.submit(external, cancel, sent)
            try:
                assert sent.wait(1)
                # An existing waiter is the witness that the first cancellation matched
                # an actual child and was processed while its setsid gate was still held.
                assert external(cancel) == dict(status="unconfirmed", generation=generation, cellId="handshake-in-flight")
                assert not interrupted.done(), "an unreaped child is not a completed stop"
            finally:
                Path("release-handshake").touch()
            assert interrupted.result() == dict(status="reaped", generation=generation, cellId="handshake-in-flight")
        assert json.loads(status.recv(4096)) == dict(kind="cancelled", generation=generation, cellId="handshake-in-flight")
        assert data.recv(1) == b"", "a cancelled handshake never released the data protocol"
    print("PASS forkserver control: stale generation and PID/PGID refused, pre-handshake request never released", flush=True)
`;

await withTargetFixture(async ({ runtime, tempRoot }) => {
  const { python } = runtime;
  assert(isAbsolute(python));
  const [bootstrap, launcher] = await Promise.all(["bootstrap.py", "launch-python.py"].map((name) =>
    readFile(new URL(`process/${name}`, kernel), "utf8")));
  await writeFile(join(tempRoot, "delay_handshake.py"), `import os
import time
from pathlib import Path

def delay_handshake():
    if Path('delay-handshake').exists():
        Path('at-fork-child').touch()
        for _ in range(600):
            if Path('release-handshake').exists():
                return
            time.sleep(.005)

os.register_at_fork(after_in_child=delay_handshake)
`);
  const child = spawn(python, ["-u", "-c", bootstrap, String(runtime.processWindow.maxFrameBytes)], {
    cwd: tempRoot, env: { ...process.env, HOME: tempRoot, PRK_HOME: tempRoot, TMPDIR: tempRoot, PYTHONPATH: tempRoot },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const ended = once(child, "close");
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  const deadline = setTimeout(() => child.kill("SIGKILL"), 8000);
  try {
    child.stdin.end(JSON.stringify({ launcher, source, forkserverSource: buildForkserver(), configuration: {
      generation: crypto.randomUUID(), maxActiveCells: 3, processWindow: runtime.processWindow,
      forkserverPreload: ["delay_handshake"], options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false },
    } }) + "\n");
    assert.deepEqual(await ended, [0, null], output);
    assert.match(output, /PASS forkserver control/);
    console.log(output.trim().split("\n").find((line) => line.startsWith("PASS ")));
  } finally { clearTimeout(deadline); }
}, { tempParent: "/tmp" });
