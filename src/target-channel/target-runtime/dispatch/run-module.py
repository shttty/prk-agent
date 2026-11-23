def run_module(name, source, incoming, outgoing, ready, started, closers):
    def emit(event):
        message = dict(event)
        message["mod"] = name
        send(outgoing, message)

    module = None
    startup_error = None
    try:
        namespace = {"__name__": "target_channel." + name, "PROCESS_LIMITS": PROCESS_LIMITS}
        exec(compile(source, "target_channel/" + name + ".py", "exec"), namespace)
        module = namespace["create"](emit)
        if hasattr(module, "shutdown"):
            closers.append(module.shutdown)
    except Exception as error:
        startup_error = error_text(error)
    ready.set()
    started.wait()
    if startup_error is not None:
        emit({"t": "error", "error": startup_error})
    next_tick = time.monotonic()
    while True:
        if module is None:
            command = incoming.get()
            send(outgoing, {"re": command["id"], "error": startup_error})
            continue
        try:
            command = incoming.get(timeout=max(0.0, next_tick - time.monotonic()))
        except queue.Empty:
            command = None
        if command is not None:
            try:
                result = module.handle(command)
                if result is not None and not isinstance(result, dict):
                    raise TypeError("module handle must return a dict or None")
                reply = dict(result or {})
                reply["re"] = command["id"]
                send(outgoing, reply)
            except Exception as error:
                send(outgoing, {"re": command["id"], "error": error_text(error)})
        now = time.monotonic()
        if now >= next_tick:
            try:
                if hasattr(module, "tick"):
                    module.tick(now)
            except Exception as error:
                emit({"t": "error", "error": error_text(error)})
            next_tick = time.monotonic() + TICK_SECONDS


