def read_frames(ctx):
    pending = bytearray()
    try:
        while not ctx.stopping.is_set():
            chunk = ctx.connection.recv(65536)
            if not chunk:
                break
            pending.extend(chunk)
            while True:
                newline = pending.find(b"\n")
                if newline < 0:
                    break
                if newline > MAX_FRAME_BYTES:
                    raise ValueError("remote extension frame exceeds the byte limit")
                line = bytes(pending[:newline])
                del pending[:newline + 1]
                frame = json.loads(line.decode("utf-8"))
                if not isinstance(frame, dict):
                    raise ValueError("remote extension frame must be an object")
                if not ctx.stopping.is_set():
                    publish_frame_chunks(ctx, line)
            if len(pending) > MAX_FRAME_BYTES:
                raise ValueError("remote extension frame exceeds the byte limit")
        if pending and not ctx.stopping.is_set():
            raise ValueError("remote extension socket ended during a frame")
    except (OSError, ValueError) as error:
        if not ctx.stopping.is_set():
            publish_log(ctx, "stderr", "Remote extension IPC: " + str(error) + "\n")
    finally:
        terminate_child(ctx)

