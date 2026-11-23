def is_scope_populated(ctx):
    if ctx.scope is None:
        ctx.process.poll()
        try:
            os.killpg(ctx.process.pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
    path = ctx.scope_path
    if path is None:
        result = subprocess.run(["systemctl", "--user", "show", ctx.scope, "--property=LoadState",
                                 "--property=ActiveState", "--property=ControlGroup"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                universal_newlines=True, timeout=SYSTEMD_SECONDS)
        state = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        if state.get("LoadState") == "not-found":
            return False
        if result.returncode:
            raise ValueError(result.stderr.strip() or "cannot inspect the owned systemd scope")
        group = state.get("ControlGroup")
        if not group:
            if state.get("ActiveState") in ("inactive", "failed"):
                return False
            raise ValueError("systemd did not report the owned scope's control group")
        path = os.path.join("/sys/fs/cgroup", group.lstrip("/"))
    try:
        with open(os.path.join(path, "cgroup.events")) as source:
            populated = dict(line.split() for line in source).get("populated")
    except FileNotFoundError:
        return False
    if populated not in ("0", "1"):
        raise ValueError("cannot verify whether the owned scope is populated")
    return populated == "1"

