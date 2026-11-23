def shutdown(ctx):
    with ctx.lock:
        ctx.stopped = True
        close(ctx)

