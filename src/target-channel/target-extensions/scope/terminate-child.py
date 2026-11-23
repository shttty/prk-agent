def terminate_child(ctx):
    with ctx.termination_lock:
        if ctx.terminated:
            return
        ctx.stopping.set()
        ctx.frame_input = None
        if ctx.connection is not None:
            try:
                ctx.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            ctx.connection.close()
        errors = []
        if ctx.scope is None:
            pgid = ctx.process.pid
            try:
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            except OSError as error:
                errors.append(str(error))
            until = time.monotonic() + STOP_SECONDS
            while time.monotonic() < until and is_scope_populated(ctx):
                time.sleep(0.02)
            if is_scope_populated(ctx):
                try:
                    os.killpg(pgid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as error:
                    errors.append(str(error))
                until = time.monotonic() + 0.5
                while time.monotonic() < until and is_scope_populated(ctx):
                    time.sleep(0.02)
            try:
                ctx.process.wait(timeout=STOP_SECONDS)
            except subprocess.TimeoutExpired:
                errors.append("unscoped host leader did not exit")
            if is_scope_populated(ctx):
                errors.append("process group is still populated")
            label = "pgid=" + str(pgid)
        else:
            stop_error = None
            try:
                result = subprocess.run(["systemctl", "--user", "stop", ctx.scope],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                        universal_newlines=True, timeout=SYSTEMD_SECONDS)
                if result.returncode:
                    stop_error = result.stderr.strip() or "systemctl stop failed"
            except (OSError, subprocess.SubprocessError) as error:
                stop_error = str(error)
            try:
                ctx.process.wait(timeout=STOP_SECONDS)
            except subprocess.TimeoutExpired:
                try:
                    ctx.process.kill()
                    ctx.process.wait(timeout=STOP_SECONDS)
                except (OSError, subprocess.SubprocessError) as error:
                    errors.append(str(error))
            try:
                if is_scope_populated(ctx):
                    errors.append("scope is still populated" + (": " + stop_error if stop_error else ""))
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                errors.append(str(error) + ("; " + stop_error if stop_error else ""))
            label = ctx.scope
        if ctx.process.poll() is not None and not ctx.exit_status.closed:
            with ctx.exit_status:
                status = ctx.exit_status.read(64)
            if status:
                try:
                    ctx.host_exit_code = int(status)
                except ValueError:
                    errors.append("invalid owned host exit status")
        shutil.rmtree(ctx.directory, ignore_errors=True)
        ctx.cleanup_error = ("Remote extension cleanup unconfirmed (" + label + "): "
                              + "; ".join(errors)) if errors else None
        ctx.terminated = not errors
        if ctx.cleanup_error:
            publish_log(ctx, "stderr", ctx.cleanup_error + "\n")

