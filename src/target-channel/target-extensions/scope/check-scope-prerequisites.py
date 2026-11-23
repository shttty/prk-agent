def can_use_scope(ctx, env):
    key = (env.get("DBUS_SESSION_BUS_ADDRESS"), env.get("XDG_RUNTIME_DIR"), env.get("PATH"), env.get("PRK_FORCE_UNSCOPED"))
    if key in ctx.scope_cache:
        return ctx.scope_cache[key]
    if env.get("PRK_FORCE_UNSCOPED") == "1":
        ctx.scope_cache[key] = (False, "PRK_FORCE_UNSCOPED=1")
        return ctx.scope_cache[key]
    try:
        path = env.get("PATH")
        for executable in ("systemctl", "systemd-run", "sh"):
            if shutil.which(executable, path=path) is None:
                raise ValueError(executable + " is unavailable")
        with open("/proc/self/cgroup") as source:
            if not any(line.startswith("0::") for line in source):
                raise ValueError("cgroup v2 is unavailable")
        with open("/sys/fs/cgroup/cgroup.controllers") as source:
            if "memory" not in source.read().split():
                raise ValueError("cgroup-v2 memory controller is unavailable")
        sh_bin = shutil.which("sh", path=path)
        subprocess.run(["systemd-run", "--user", "--scope", "--quiet", "--no-ask-password",
                        "-p", "MemoryMax=67108864", "-p", "MemorySwapMax=0", sh_bin, "-c", ":"],
                       env=env, check=True, stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=SYSTEMD_SECONDS)
        ctx.scope_cache[key] = (True, None)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        detail = error.stderr.decode("utf-8", "replace").strip() if isinstance(error, subprocess.CalledProcessError) else str(error)
        ctx.scope_cache[key] = (False, detail or type(error).__name__)
    return ctx.scope_cache[key]

