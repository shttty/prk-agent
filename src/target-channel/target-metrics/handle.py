def handle(ctx, command):
    if command.get("op") != "config":
        raise ValueError("unknown customMetrics operation: " + str(command.get("op")))
    with ctx.lock:
        if ctx.stopped:
            return
        now = time.monotonic()
        if now >= ctx.expires_at:
            close(ctx)
        metrics = command["metrics"]
        if metrics != ctx.metrics:
            close(ctx)
            ctx.metrics = metrics
            ctx.items = [{"metric": metric, "due": now, "process": None} for metric in metrics]
        ctx.timeout = command["timeoutMs"] / 1000
        ctx.maximum = command["maxOutputBytes"]
        ctx.expires_at = now + command["leaseMs"] / 1000

