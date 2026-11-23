def publish_log(ctx, stream, data):
    if data:
        if stream == "stderr" and ctx.startup_stderr is not None:
            ctx.startup_stderr = (ctx.startup_stderr + data)[-4096:]
        ctx.emit({"t": "log", "generation": ctx.generation, "stream": stream, "data": data})

