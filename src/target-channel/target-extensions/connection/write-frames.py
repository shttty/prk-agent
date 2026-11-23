def write_frames(ctx):
    try:
        while not ctx.stopping.is_set():
            try:
                frame = ctx.outgoing.get(timeout=0.2)
            except queue.Empty:
                continue
            ctx.connection.sendall(frame)
    except OSError as error:
        if not ctx.stopping.is_set():
            publish_log(ctx, "stderr", "Remote extension IPC: " + str(error) + "\n")
        terminate_child(ctx)

