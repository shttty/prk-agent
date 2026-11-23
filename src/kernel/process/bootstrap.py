import json
import os
from pathlib import Path
import subprocess
import sys


# Read the already bounded deployment from the private handoff, not control stdin.
python_scoped_entry = """
import json
import os
import sys

with os.fdopen(int(sys.argv[1]), 'rb') as payload:
    deployment = json.load(payload)
exec(compile(deployment['launcher'], '<PRK Python launcher>', 'exec'), globals())
launch_python(deployment['configuration'], deployment['source'], deployment['forkserverSource'])
"""


def create_deployment_fd():
    if hasattr(os, "memfd_create"):
        return os.memfd_create("prk-python-deployment")
    # Some supported CPython 3.9 builds lack the wrapper even when libc provides it.
    import ctypes

    libc = ctypes.CDLL(None, use_errno=True)
    fd = libc.memfd_create(b"prk-python-deployment", 1)  # MFD_CLOEXEC
    if fd < 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    return fd


def bootstrap_kernel():
    # Consume only the bounded deployment line before handing off control stdin.
    maximum = int(sys.argv[1])
    bun = sys.argv[2:] == ["bun"]
    with os.fdopen(0, "rb", buffering=0, closefd=False) as control:
        raw = control.readline(maximum + 1)
    if len(raw) > maximum or not raw.endswith(b"\n"):
        raise ValueError("Kernel bootstrap exceeds process frame budget")
    deployment = json.loads(raw)
    if sys.version_info < (3, 9):
        raise RuntimeError("PRK requires Python 3.9 or newer")
    if bun:
        if not isinstance(deployment, dict) or deployment.keys() != {"executable", "source", "generation", "scope", "chunkBytes", "startTimeoutMs", "runtime"}:
            raise ValueError("Invalid Bun kernel startup configuration")
        executable, source = deployment["executable"], deployment["source"]
        if not isinstance(executable, str) or not os.path.isabs(executable):
            raise ValueError("Bun kernel requires a deployed absolute executable path")
        if not isinstance(source, str) or not source:
            raise ValueError("Missing Bun kernel startup source")
        scope = deployment["scope"]
        if (not isinstance(scope, dict) or scope.keys() != {"enabled", "unit", "memoryMax", "memorySwapMax"}
                or type(scope["enabled"]) is not bool or any(not isinstance(scope[key], str) for key in ("unit", "memoryMax", "memorySwapMax"))):
            raise ValueError("Invalid Bun kernel scope configuration")
        if (not isinstance(deployment["generation"], str) or not deployment["generation"]
                or any(type(deployment[key]) is not int or deployment[key] <= 0 for key in ("chunkBytes", "startTimeoutMs"))):
            raise ValueError("Invalid Bun kernel startup limits or generation")
        runtime = deployment["runtime"]
        runtime_keys = {"maxMessageBytes", "maxImages", "maxImageBytes", "maxActiveCells"}
        if (not isinstance(runtime, dict) or runtime.keys() != runtime_keys | {"packageRoot"}
                or any(type(runtime[key]) is not int or runtime[key] <= 0 for key in runtime_keys)
                or not isinstance(runtime["packageRoot"], str)
                or (runtime["packageRoot"] and not os.path.isabs(runtime["packageRoot"]))):
            raise ValueError("Invalid Bun runtime limits or package path")
        timeout_ms = deployment["startTimeoutMs"]
    else:
        if not isinstance(deployment, dict) or deployment.keys() != {"source", "launcher", "forkserverSource", "configuration"}:
            raise ValueError("Invalid Python kernel startup configuration")
        configuration = deployment["configuration"]
        source = deployment["source"]
        launcher = deployment["launcher"]
        forkserver_source = deployment["forkserverSource"]
        if any(not isinstance(item, str) or not item for item in (source, launcher, forkserver_source)):
            raise ValueError("Missing Python kernel startup source")
        scope = configuration["scope"]
        timeout_ms = configuration["options"]["startTimeoutMs"]
    def bun_command(scoped):
        return [sys.executable, "-u", "-c", bun_launcher, executable, source, deployment["generation"],
                "true" if scoped else "false", str(maximum), str(deployment["chunkBytes"]), json.dumps(runtime)]

    fallback = "scope disabled" if not scope["enabled"] else None
    if os.environ.get("PRK_FORCE_UNSCOPED") == "1":
        fallback = "PRK_FORCE_UNSCOPED=1"
    if fallback is None:
        try:
            if "memory" not in Path("/sys/fs/cgroup/cgroup.controllers").read_text().split():
                raise OSError("cgroup-v2 memory controller is unavailable")
            subprocess.run(["systemd-run", "--user", "--scope", "--quiet", "--no-ask-password",
                            "-p", "MemoryMax=" + scope["memoryMax"],
                            "-p", "MemorySwapMax=" + scope["memorySwapMax"],
                            "/bin/true"], check=True, stdin=subprocess.DEVNULL,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                           timeout=timeout_ms / 1000)
        except (OSError, subprocess.SubprocessError) as error:
            fallback = str(error)
    if fallback is not None:
        sys.stderr.write("PRK kernel unscoped: " + fallback + "\n")
        sys.stderr.flush()
        if bun:
            os.execv(sys.executable, bun_command(False))
        os.environ["PRK_KERNEL_UNSCOPED"] = "1"
        exec(compile(launcher, "<PRK Python launcher>", "exec"), globals())
        launch_python(configuration, source, forkserver_source)
    else:
        scoped = ["systemd-run", "--user", "--scope", "--quiet", "--no-ask-password",
                  "--unit=" + scope["unit"], "-p", "MemoryMax=" + scope["memoryMax"],
                  "-p", "MemorySwapMax=" + scope["memorySwapMax"]]
        if bun:
            # systemd expands dollar expressions even in argv, not only in shell commands.
            os.execvp(scoped[0], scoped + [argument.replace("$", "$$") for argument in bun_command(True)])
        # Runner and forkserver source must not share a size-limited exec argument.
        with os.fdopen(create_deployment_fd(), "w+b") as payload:
            payload.write(raw)
            payload.seek(0)
            fd = payload.fileno()
            os.set_inheritable(fd, True)
            os.execvp(scoped[0], scoped + [sys.executable, "-u", "-c", python_scoped_entry, str(fd)])


bootstrap_kernel()
