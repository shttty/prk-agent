def start_logs(ctx):
    for stream, source in (("stdout", ctx.process.stdout), ("stderr", ctx.process.stderr)):
        thread = threading.Thread(target=partial(read_log, ctx), args=(stream, source), daemon=True)
        ctx.log_threads.append(thread)
        thread.start()

