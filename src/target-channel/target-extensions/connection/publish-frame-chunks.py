def publish_frame_chunks(ctx, data):
    total = len(data)
    envelope = {"t": "frameChunk", "generation": ctx.generation, "total": total,
                "offset": total, "last": False, "data": "", "mod": "remoteExtensions"}
    overhead = len(json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) + 1
    size = ((PROCESS_LIMITS["maxFrameBytes"] - overhead) // 4) * 3
    if size < 1:
        raise ValueError("process frame budget cannot contain a host output chunk")
    for offset in range(0, total, size):
        if ctx.stopping.is_set():
            return
        chunk = data[offset:offset + size]
        ctx.emit({"t": "frameChunk", "generation": ctx.generation, "total": total,
                  "offset": offset, "last": offset + len(chunk) == total,
                  "data": base64.b64encode(chunk).decode("ascii")})
