def receive_frame_chunk(ctx, command):
    if ctx.stopping.is_set() or ctx.process.poll() is not None:
        raise ValueError("remote extension generation is not running")
    total, offset, last, encoded = (command.get(key) for key in ("total", "offset", "last", "data"))
    try:
        if (type(total) is not int or not 1 <= total <= MAX_FRAME_BYTES
                or type(offset) is not int or not 0 <= offset < total
                or type(last) is not bool or not isinstance(encoded, str)):
            raise ValueError("invalid remote extension frame chunk")
        data = base64.b64decode(encoded, validate=True)
        if not data or base64.b64encode(data).decode("ascii") != encoded or offset + len(data) > total:
            raise ValueError("invalid remote extension chunk bytes")
        if ctx.frame_input is None:
            if offset != 0:
                raise ValueError("remote extension frame must begin at offset zero")
            ctx.frame_input = {"buffer": bytearray(total), "offset": 0}
        current = ctx.frame_input
        if len(current["buffer"]) != total or current["offset"] != offset or last != (offset + len(data) == total):
            raise ValueError("remote extension frame chunk is out of order")
        current["buffer"][offset:offset + len(data)] = data
        current["offset"] += len(data)
        if last:
            ctx.frame_input = None
            frame = json.loads(current["buffer"].decode("utf-8"))
            send_frame(ctx, frame)
        return {}
    except BaseException:
        ctx.frame_input = None
        raise
