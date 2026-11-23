def close(ctx):
    with ctx.lock:
        for item in ctx.items:
            process = item["process"]
            if process is not None:
                stop_process(process)
                ctx.retired.append((item["metric"]["name"], process))
        ctx.metrics = []
        ctx.items = []
        ctx.expires_at = 0
        ctx.retired = [(name, process) for name, process in ctx.retired if process.poll() is None]

