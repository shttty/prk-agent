def serve(modules, outgoing, readiness, started, stopping):
    pending = b""
    hello_sent = False
    while not stopping.is_set():
        if not hello_sent and all(ready.is_set() for ready in readiness):
            send(outgoing, {"t": "hello", "version": VERSION, "pid": os.getpid()})
            started.set()
            hello_sent = True
        poll_interval = TICK_SECONDS if hello_sent else 0.01
        ready, _, _ = select.select([0], [], [], poll_interval)
        if not ready:
            continue
        chunk = os.read(0, 65536)
        if not chunk:
            return
        pending += chunk
        while b"\n" in pending:
            line, pending = pending.split(b"\n", 1)
            if len(line) + 1 > PROCESS_LIMITS["maxFrameBytes"]:
                raise ValueError("process input frame exceeds byte limit")
            if not line.strip():
                continue
            command = None
            try:
                command = json.loads(line.decode("utf-8"))
                if not isinstance(command, dict) or type(command.get("id")) is not int:
                    raise ValueError("request requires an integer id")
                name = command.get("mod")
                if name != "runtime":
                    if name not in modules:
                        raise ValueError("unknown module: " + str(name))
                    modules[name].put_nowait(command)
                    continue
                op = command.get("op")
                if op != "quit":
                    raise ValueError("unknown runtime operation: " + str(op))
                send(outgoing, {"re": command["id"]})
                return
            except Exception as error:
                if isinstance(command, dict) and "id" in command:
                    send(outgoing, {"re": command["id"], "error": error_text(error)})
                else:
                    send(outgoing, {"mod": "runtime", "t": "error", "error": error_text(error)})
        if len(pending) >= PROCESS_LIMITS["maxFrameBytes"]:
            raise ValueError("unterminated process input exceeds byte limit")


