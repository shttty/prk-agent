def await_scope(ctx, deadline):
    ctx.connection.settimeout(max(0.001, deadline - time.monotonic()))
    try:
        data = bytearray()
        while not data.endswith(b"\n"):
            chunk = ctx.connection.recv(1)
            if not chunk:
                raise ValueError("scope launcher closed its IPC socket before the startup handshake")
            data.extend(chunk)
            if len(data) > 65536:
                raise ValueError("scope startup handshake exceeds the byte limit")
        result = json.loads(data.decode("utf-8"))
        if not isinstance(result, dict):
            raise ValueError("invalid scope startup handshake")
        if "error" in result:
            raise ValueError(str(result["error"]))
        pid = result.get("pid")
        if type(pid) is not int or pid <= 0 or pid == ctx.process.pid or result.get("rootPid") != ctx.process.pid:
            raise ValueError("host/root PID handshake does not match the owned root")
        if os.getpgid(pid) != ctx.process.pid:
            raise ValueError("host is not in its owned root process group")
        if sys.platform.startswith("linux"):
            with open("/proc/" + str(pid) + "/status") as source:
                parent = next((int(line.split()[1]) for line in source if line.startswith("PPid:")), None)
            if parent != ctx.process.pid:
                raise ValueError("host is not a direct child of its owned root")
        ctx.host_pid = pid
        path = result.get("scope")
        if ctx.scope is None:
            if path not in (None, ""):
                raise ValueError("unscoped startup handshake does not match the owned process")
            ctx.scope_path = None
        else:
            if not isinstance(path, str) or os.path.basename(path) != ctx.scope:
                raise ValueError("scope startup handshake does not match the owned process")
            ctx.scope_path = path
        ctx.startup_stderr = None
    finally:
        ctx.connection.settimeout(None)

