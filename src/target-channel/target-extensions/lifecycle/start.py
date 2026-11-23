def start(ctx, command):
    generation = command.get("generation")
    if not isinstance(generation, str) or not generation:
        raise ValueError("generation must be a nonempty string")
    runtime = absolute_path(command.get("runtime"))
    host = absolute_path(command.get("host"))
    cwd = absolute_path(command.get("cwd"))
    environment = command.get("env", {})
    if not isinstance(environment, dict) or any(not isinstance(key, str) or not isinstance(value, str)
                                                 for key, value in environment.items()):
        raise ValueError("env must be a string-valued object")
    prepend = command.get("pathPrepend", [])
    if not isinstance(prepend, list) or len(prepend) > 2:
        raise ValueError("pathPrepend must contain at most two absolute directories")
    prepend = [absolute_path(path) for path in prepend]
    runtime_args = command.get("runtimeArgs")
    if not isinstance(runtime_args, list) or any(not isinstance(arg, str) or "\0" in arg for arg in runtime_args):
        raise ValueError("runtimeArgs must be an array of strings without NUL")
    limits = {}
    for key, default, minimum, maximum in (("memoryMax", 1073741824, 1, 9007199254740991),
                                            ("memorySwapMax", 0, 0, 9007199254740991)):
        value = command.get(key, default)
        if type(value) is not int or not minimum <= value <= maximum:
            raise ValueError(key + " must be an integer from " + str(minimum) + " to " + str(maximum))
        limits[key] = value
    with ctx.lock:
        if ctx.closed:
            raise ValueError("remote extension module has shut down")
        if generation in ctx.generations:
            raise ValueError("remote extension generation has already been used")
        env = dict(os.environ)
        env.update(environment)
        if prepend:
            env["PATH"] = os.pathsep.join(prepend + [env.get("PATH", os.defpath)])
        use_scope, scope_reason = can_use_scope(ctx, env)
        for key in ("PRK_EXT_SCOPE", "PRK_EXT_SCOPE_PATH", "PRK_EXT_MEMORY_MAX", "PRK_EXT_MEMORY_SWAP_MAX"):
            env.pop(key, None)
        scope = ("prk-remote-host-" + uuid.uuid4().hex + ".scope") if use_scope else None
        directory = tempfile.mkdtemp(prefix="prk-", dir=os.environ.get("XDG_RUNTIME_DIR") or "/tmp")
        socket_path = os.path.join(directory, "s")
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        env.update({"PRK_EXT_SOCKET": socket_path,
                    "PRK_EXT_RUNTIME": runtime, "PRK_EXT_HOST": host, "PRK_EXT_RUNTIME_ARGS": json.dumps(runtime_args),
                    "PRK_EXT_PARENT_PID": str(os.getpid()), "PRK_EXT_STOP_SECONDS": str(STOP_SECONDS),
                    "PRK_EXT_SYSTEMD_SECONDS": str(SYSTEMD_SECONDS)})
        if use_scope:
            env.update({"PRK_EXT_SCOPE": scope, "PRK_EXT_MEMORY_MAX": str(limits["memoryMax"]),
                        "PRK_EXT_MEMORY_SWAP_MAX": str(limits["memorySwapMax"])})
        child = None
        status_read = status_write = None
        deadline = time.monotonic() + START_SECONDS
        try:
            listener.bind(socket_path)
            listener.listen(1)
            status_read, status_write = os.pipe()
            env["PRK_EXT_STATUS_FD"] = str(status_write)
            argv = (["systemd-run", "--user", "--scope", "--quiet", "--no-ask-password",
                     "--unit=" + scope, "-p", "MemoryMax=" + str(limits["memoryMax"]),
                     "-p", "MemorySwapMax=" + str(limits["memorySwapMax"]),
                     "-p", "OOMPolicy=continue",
                     "-p", "KillMode=control-group", "-p", "SendSIGKILL=yes",
                     "-p", "TimeoutStopSec=1s", sys.executable, "-c", HOST_ROOT_LAUNCH]
                    if use_scope else [sys.executable, "-c", HOST_ROOT_LAUNCH])
            process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0,
                                       start_new_session=True, pass_fds=(status_write,))
            os.close(status_write)
            status_write = None
            child = assemble_child(generation, process, None, scope, ctx.emit, partial(retire_child, ctx), directory,
                                   os.fdopen(status_read, "rb", buffering=0))
            status_read = None
            ctx.children[generation] = child
            ctx.generations.add(generation)
            start_logs(child)
            if not use_scope:
                stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                publish_log(child, "stderr", "[" + stamp + "] remoteExtensions: scoped host unavailable ("
                            + str(scope_reason) + "); falling back to unscoped process group (pgid=" + str(process.pid) + ")\n")
            listener.settimeout(max(0.001, deadline - time.monotonic()))
            child.connection, _address = listener.accept()
            os.unlink(socket_path)
        except BaseException:
            if child is not None:
                terminate_child(child)
                retire_child(ctx, child)
            else:
                shutil.rmtree(directory, ignore_errors=True)
            raise
        finally:
            listener.close()
            for fd in (status_read, status_write):
                if fd is not None:
                    os.close(fd)
        try:
            await_scope(child, deadline)
        except BaseException as error:
            terminate_child(child)
            retire_child(ctx, child)
            for thread in child.log_threads:
                thread.join(timeout=0.2)
            detail = str(error) or type(error).__name__
            if child.startup_stderr:
                detail += "; " + child.startup_stderr.strip()
            if child.cleanup_error:
                detail += "; " + child.cleanup_error
            raise ValueError("Remote extension scope startup handshake failed: " + detail)
        start_threads(child)
        return {"pid": child.host_pid, "rootPid": process.pid, "scoped": use_scope}

