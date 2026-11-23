// Real target module/scopes and both runtimes: connect, crash, and never-connect cleanup.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findFixtureExecutable } from "../fixtures/native-tool-artifacts.mjs";
import { TARGET_MODULE_SOURCES } from "../../src/target-channel/deployment-source/assemble-runtime-source.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";

assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned target processes are allowed");
const bun = await findFixtureExecutable("bun", process.env.PI_TEST_BUN_BINARY);
const source = `PROCESS_LIMITS = ${JSON.stringify(parseProcessWindowLimits())}\n${TARGET_MODULE_SOURCES.remoteExtensions}`;
const { stdout } = await promisify(execFile)(process.env.PI_TEST_PYTHON, ["-c", String.raw`
import base64, json, os, pathlib, sys, tempfile, threading, uuid
module = {"__name__": "<run_path>"}
exec(compile(sys.argv[1], "target_channel/remoteExtensions.py", "exec"), module)
with tempfile.TemporaryDirectory(prefix="prk-socket-test-") as root:
    host = pathlib.Path(root, "host.mjs")
    host.write_text('''import { writeFileSync, readlinkSync } from "node:fs";
import { createConnection } from "node:net";
import { once } from "node:events";
const path = process.env.PRK_EXT_SOCKET;
writeFileSync(process.env.PRK_TEST_MARKER, JSON.stringify({ path,
  stdin: readlinkSync("/proc/self/fd/0"), pid: process.pid, rootPid: process.ppid, scope: process.env.PRK_EXT_SCOPE_PATH }));
if (process.env.PRK_TEST_MODE === "never-connect") setInterval(() => {}, 1000);
else if (process.env.PRK_TEST_MODE === "early-exit") process.exit(23);
else {
  const socket = createConnection({ path });
  await once(socket, "connect");
  socket.write(JSON.stringify({ pid: process.pid, rootPid: process.ppid, scope: process.env.PRK_EXT_SCOPE_PATH }) + "\\n");
  if (process.env.PRK_TEST_MODE === "crash") setTimeout(() => process.exit(23), 100);
  else socket.on("data", data => socket.write(data));
}
''')
    for runtime in sys.argv[2:4]:
        for mode in json.loads(sys.argv[4]):
            marker = pathlib.Path(root, uuid.uuid4().hex + ".json")
            exited = threading.Event()
            echoed = threading.Event()
            exit_codes = []
            def emit(event):
                if event.get("t") == "frameChunk" and event.get("last") and json.loads(base64.b64decode(event["data"])) == {"probe": "UNIX_DUPLEX_EXECUTED"}:
                    echoed.set()
                if event.get("t") == "exit":
                    exit_codes.append(event.get("code"))
                    exited.set()
            target = module["create"](emit)
            generation = uuid.uuid4().hex
            command = {"generation": generation, "runtime": runtime, "runtimeArgs": ["--smol"] if runtime == sys.argv[3] else ["--optimize-for-size"],
                       "host": str(host), "cwd": root, "env": {"PRK_TEST_MARKER": str(marker), "PRK_TEST_MODE": mode},
                       "memoryMax": 1073741824, "memorySwapMax": 0}
            try:
                if mode in ("never-connect", "early-exit"):
                    try:
                        module["start"](target, command)
                    except (OSError, ValueError) as error:
                        assert "timed out" in str(error), repr(error)
                    else:
                        raise AssertionError("A host that never connected must fail startup")
                else:
                    started = module["start"](target, command)
                    child = target.children[generation]
                    if mode == "connected":
                        observed = json.loads(marker.read_text())
                        assert started["pid"] == observed["pid"] and started["rootPid"] == observed["rootPid"]
                        assert started["pid"] != started["rootPid"]
                        assert not pathlib.Path(observed["path"]).exists(), "accept must unlink the listener path"
                        assert pathlib.Path(observed["path"]).parent.is_dir(), "The host owns its temporary directory until exit"
                        module["send_frame"](child, {"probe": "UNIX_DUPLEX_EXECUTED"})
                        assert echoed.wait(5), "The public Unix connection must carry duplex frames";
                        module["stop"](target, generation)
                    else:
                        assert exited.wait(10), "Crashed host exit must be observed"
                        assert exit_codes == [23], "Root cleanup must not replace the executing host exit code"
                    assert not module["is_scope_populated"](child), "The owned scope must be empty after stop/crash"
                observed = json.loads(marker.read_text())
                assert observed["stdin"] == "/dev/null", observed
                assert not pathlib.Path(observed["path"]).exists(), observed
                assert not pathlib.Path(observed["path"]).parent.exists(), observed
                assert not target.children, "Failed/retired startup must not leave a registered host"
                print(json.dumps({"runtime": runtime, "mode": mode, "socketCleaned": True, "directoryCleaned": True}))
            finally:
                target.shutdown()
`, source, process.execPath, bun, JSON.stringify(process.argv[2] ? [process.argv[2]] : ["connected", "crash", "never-connect", "early-exit"])], { timeout: 60_000, maxBuffer: 256 * 1024 });
console.log(stdout.trim());
console.log("PASS: Node/Bun use public Unix sockets; one-shot paths and private directories are removed on connect, crash, and never-connect startup failure");
