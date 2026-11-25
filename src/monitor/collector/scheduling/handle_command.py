def handle_command(ctx, command):
    op = command.get("op")
    if op == "config":
        if "intervalMs" in command:
            ctx.interval = max(0.5, float(command["intervalMs"]) / 1000)
            ctx.next_sample = max(ctx.ready_at, time.monotonic())
    elif op == "watch":
        roots = watch_processes(command.get("processes", {}))
        new = [directory for directory in command.get("dirs", []) if isinstance(directory, str)]
        for added in new:
            if added not in ctx.dirs:
                ctx.emit(dir_sample(added))
        ctx.dirs = new
        ctx.process_watches = roots
    elif op == "refresh":
        if command.get("dir") in ctx.dirs:
            ctx.emit(dir_sample(command["dir"]))
    elif op == "diff":
        return file_diff(str(command.get("dir")), str(command.get("path")), command.get("id"))
    else:
        raise ValueError("unknown monitor operation: " + str(op))
