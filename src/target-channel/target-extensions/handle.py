def handle(ctx, command):
    op = command.get("op")
    if op == "platform":
        return {"system": platform.system(), "machine": platform.machine(),
                "home": os.path.abspath(os.path.expanduser("~"))}
    if op == "start":
        return start(ctx, command)
    if op == "stop":
        return stop(ctx, command.get("generation"))
    with ctx.lock:
        if ctx.closed:
            raise ValueError("remote extension module has shut down")
        if op == "assetCheck":
            return begin_upload(ctx, command, True)
        if op == "assetBegin":
            return begin_upload(ctx, command)
        if op == "assetAbort":
            discard_upload(ctx, asset_sha(command.get("sha256")))
            return {}
        if op == "assetFinish":
            return finish_upload(ctx, command)
        if op == "frameChunk":
            child = ctx.children.get(command.get("generation"))
            if child is None:
                raise ValueError("remote extension generation is not running")
            return receive_frame_chunk(child, command)
    raise ValueError("unknown remoteExtensions operation: " + str(op))

