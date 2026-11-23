def send(outgoing, message):
    data = (json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    if len(data) > PROCESS_LIMITS["maxFrameBytes"]:
        raise ValueError("process output frame exceeds byte limit")
    outgoing.put(data)


