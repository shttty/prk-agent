def tick(ctx, now):
    if now < ctx.next_sample:
        return
    sample_processes(ctx, now)
    ctx.emit(sample_machine(ctx.machine))
    for directory in list(ctx.dirs):
        ctx.emit({"t": "disk", "dir": directory, "disk": disk_of(resolve(directory))})
    ctx.next_sample = time.monotonic() + ctx.interval
