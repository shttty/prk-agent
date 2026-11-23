def watch_child(ctx):
    code = ctx.process.wait()
    terminate_child(ctx)
    for thread in ctx.log_threads:
        thread.join(timeout=0.2)
    ctx.exited(ctx)
    ctx.emit({"t": "exit", "generation": ctx.generation, "pid": ctx.host_pid, "rootPid": ctx.process.pid,
               "code": ctx.host_exit_code, "rootExitCode": code,
               **({"cleanupError": ctx.cleanup_error} if ctx.cleanup_error else {})})

