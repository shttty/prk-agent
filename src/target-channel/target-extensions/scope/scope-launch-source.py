# The launcher remains the owned root; plugin code runs only in its child.
HOST_ROOT_LAUNCH = r"""
import ctypes, json, os, shutil, signal, subprocess, sys, time

env = dict(os.environ)
scope = env.pop("PRK_EXT_SCOPE", None)
parent_pid = int(env.pop("PRK_EXT_PARENT_PID"))
stop_seconds = float(env.pop("PRK_EXT_STOP_SECONDS"))
systemd_seconds = float(env.pop("PRK_EXT_SYSTEMD_SECONDS"))
status_fd = int(env.pop("PRK_EXT_STATUS_FD"))
directory = os.path.dirname(env["PRK_EXT_SOCKET"])
cleaning = False

def parent_stopped(signum, frame):
    stop_tree()

def stop_tree():
    global cleaning
    if cleaning:
        return
    cleaning = True
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    shutil.rmtree(directory, ignore_errors=True)
    try:
        if scope:
            try:
                stopped = subprocess.run(["systemctl", "--user", "stop", scope],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                         timeout=systemd_seconds)
                if stopped.returncode:
                    sys.stderr.write("PRK host root could not stop owned scope " + scope + "\n")
            except (OSError, subprocess.SubprocessError) as error:
                sys.stderr.write("PRK host root scope cleanup failed: " + str(error) + "\n")
    finally:
        # A disconnected log pipe must not prevent the owned process-group cleanup.
        os.killpg(os.getpgrp(), signal.SIGTERM)
        time.sleep(stop_seconds)
        os.killpg(os.getpgrp(), signal.SIGKILL)

if os.getpgrp() != os.getpid():
    raise ValueError("host root must lead its own process group")

try:
    signal.signal(signal.SIGTERM, parent_stopped)
    signal.signal(signal.SIGHUP, parent_stopped)
    if sys.platform.startswith("linux"):
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(1, signal.SIGHUP, 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "PR_SET_PDEATHSIG failed")
        if os.getppid() != parent_pid:
            raise SystemExit(0)
    else:
        sys.stderr.write("PRK host cleanup degraded: non-Linux target has no parent-death signal; disconnect cleanup is not guaranteed\n")
    if scope:
        with open("/proc/self/cgroup") as source:
            groups = [line.strip()[3:] for line in source if line.startswith("0::")]
        if len(groups) != 1 or os.path.basename(groups[0]) != scope:
            raise ValueError("host root is not in its own systemd scope " + scope)
        scope_path = os.path.join("/sys/fs/cgroup", groups[0].lstrip("/"))
        for filename, key in (("memory.max", "PRK_EXT_MEMORY_MAX"), ("memory.swap.max", "PRK_EXT_MEMORY_SWAP_MAX")):
            expected = env.pop(key)
            with open(os.path.join(scope_path, filename)) as source:
                actual = source.read().strip()
            if actual != expected:
                raise ValueError(filename + " is " + actual + ", expected " + expected)
        for filename in ("memory.current", "memory.events", "cgroup.events"):
            with open(os.path.join(scope_path, filename)) as source:
                source.read()
        env["PRK_EXT_SCOPE_PATH"] = scope_path
    else:
        for key in ("PRK_EXT_MEMORY_MAX", "PRK_EXT_MEMORY_SWAP_MAX", "PRK_EXT_SCOPE_PATH"):
            env.pop(key, None)
    runtime, host = env.pop("PRK_EXT_RUNTIME"), env.pop("PRK_EXT_HOST")
    runtime_args = json.loads(env.pop("PRK_EXT_RUNTIME_ARGS"))
    child = subprocess.Popen([runtime, *runtime_args, host], env=env)
    code = child.wait()
    os.write(status_fd, (str(code) + "\n").encode("ascii"))
    os.close(status_fd)
except (Exception, KeyboardInterrupt) as error:
    sys.stderr.write("PRK remote host root failed: " + str(error) + "\n")
finally:
    stop_tree()
"""


