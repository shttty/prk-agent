def send_frame(ctx, frame):
    if ctx.stopping.is_set() or ctx.process.poll() is not None:
        raise ValueError("remote extension generation is not running")
    if not isinstance(frame, dict):
        raise ValueError("remote extension frame must be an object")
    data = (json.dumps(frame, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
    if len(data) - 1 > MAX_FRAME_BYTES:
        raise ValueError("remote extension frame exceeds the byte limit")
    try:
        ctx.outgoing.put_nowait(data)
    except queue.Full:
        raise ValueError("remote extension IPC send queue is full")
    # Never await a host reply here: it may be awaiting a reverse Gateway call.

