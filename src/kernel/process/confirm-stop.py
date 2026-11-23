import os
from pathlib import Path
import subprocess
import sys
import time


def scope_group(unit):
    result = subprocess.run(["systemctl", "--user", "show", unit, "--property=LoadState",
                             "--property=ControlGroup", "--property=ActiveState"],
                            capture_output=True, text=True)
    state = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    if state.get("LoadState") == "not-found":
        return None
    result.check_returncode()
    group = state.get("ControlGroup")
    if group and group.startswith("/") and Path(group).name == unit:
        return Path("/sys/fs/cgroup") / group.lstrip("/")
    if not group and state.get("ActiveState") in ("inactive", "failed"):
        return None
    raise RuntimeError("Cannot resolve owned scope ControlGroup")


def populated(group):
    if group is None:
        return False
    try:
        events = (group / "cgroup.events").read_text()
    except FileNotFoundError:
        # Only an absent cgroup is proof, not a failure to read an existing one.
        try:
            group.stat()
        except FileNotFoundError:
            return False
        raise
    count = dict(line.split() for line in events.splitlines()).get("populated")
    if count not in ("0", "1"):
        raise RuntimeError("Cannot read owned scope population")
    return count == "1"


def exists(pid):
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def confirm_stop(daemon_pgid, runner_pid, runner_pgid, scope, seconds, poll):
    deadline = time.monotonic() + seconds
    # Close is only a cancellation request. Use public exec to check the daemon
    # group (the public started PID is its leader) plus the runner's own IDs.
    group = None
    checked_after_launch_exit = False
    while time.monotonic() < deadline:
        daemon_alive = exists(-daemon_pgid)
        if scope and group is None and not checked_after_launch_exit:
            # Startup can be stopped before ready or before systemd has registered
            # the scope. A missing scope counts only after the launcher is gone.
            group = scope_group(scope)
            checked_after_launch_exit = not daemon_alive
            if group is not None:
                # Retain the actual ControlGroup path even if systemd unloads the unit.
                subprocess.run(["systemctl", "--user", "stop", scope], capture_output=True)
        if not daemon_alive and not exists(runner_pid) and not exists(-runner_pgid) and not populated(group):
            return
        time.sleep(poll)
    raise RuntimeError("Owned kernel scope or process group did not empty")


confirm_stop(*map(int, sys.argv[1:4]), sys.argv[4], *map(float, sys.argv[5:7]))
