import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

assert(process.env.PI_TEST_PYTHON);
const { stdout } = await promisify(execFile)(process.env.PI_TEST_PYTHON, ["-c", String.raw`
import json, os, pathlib, runpy, signal, subprocess, sys, tempfile, time

source = runpy.run_path("src/target-channel/target-extensions/scope/scope-launch-source.py")["HOST_ROOT_LAUNCH"]
# Deliver the second real signal exactly as finally enters stop_tree, before its body.
trace = '''import os, signal, sys
fired = False
def trace(frame, event, arg):
    global fired
    if event == "call" and frame.f_code.co_name == "stop_tree" and not fired:
        fired = True
        os.kill(os.getpid(), signal.SIGHUP)
    return trace
sys.settrace(trace)
'''
with tempfile.TemporaryDirectory(prefix="prk-S5-root-signal-") as directory:
    root = pathlib.Path(directory)
    socket_dir = root / "socket"
    socket_dir.mkdir()
    marker = root / "pids.json"
    child = root / "child.py"
    child.write_text("import json,os,subprocess\np=subprocess.Popen(['sleep','600'])\n"
                     + "open(" + repr(str(marker)) + ",'w').write(json.dumps([os.getpid(),p.pid]))\nraise SystemExit(23)\n")
    read_fd, write_fd = os.pipe()
    env = dict(os.environ)
    env.pop("PRK_EXT_SCOPE", None)
    env.update(PRK_EXT_SOCKET=str(socket_dir / "s"), PRK_EXT_PARENT_PID=str(os.getpid()),
               PRK_EXT_STOP_SECONDS="0.05", PRK_EXT_SYSTEMD_SECONDS="5", PRK_EXT_STATUS_FD=str(write_fd),
               PRK_EXT_RUNTIME=sys.executable, PRK_EXT_HOST=str(child), PRK_EXT_RUNTIME_ARGS="[]")
    process = subprocess.Popen([sys.executable, "-c", trace + source], env=env,
                               start_new_session=True, pass_fds=(write_fd,), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    os.close(write_fd)
    try:
        out, err = process.communicate(timeout=10)
        pids = json.loads(marker.read_text())
        alive = []
        for attempt in range(100):
            alive = []
            for pid in pids:
                try:
                    state = pathlib.Path("/proc/%s/stat" % pid).read_text().rsplit(") ", 1)[1].split()[0]
                    if state not in ("Z", "X"): alive.append(pid)
                except FileNotFoundError: pass
            if not alive: break
            time.sleep(0.01)
        assert not alive, "Reentrant signal abandoned owned descendants: " + repr(alive)
        assert process.returncode == -signal.SIGKILL, (process.returncode, err)
        assert os.read(read_fd, 64) == b"23\n", "Root cleanup changed the executing child's exit code"
        assert not socket_dir.exists()
        print(json.dumps({"status":"PASS", "rootPid":process.pid, "childPids":pids,
                          "signalAtCleanupEntry":True, "executingExitCode":23}))
    finally:
        try: os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError: pass
        process.wait()
        os.close(read_fd)
`], { timeout: 20_000 });
console.log(stdout.trim());
