def tick(ctx, now):
    with ctx.lock:
        if ctx.stopped:
            return
        ctx.retired = [(name, process) for name, process in ctx.retired if process.poll() is None]
        for item in ctx.items:
            now = time.monotonic()
            if now >= ctx.expires_at:
                close(ctx)
                return
            metric = item["metric"]
            process = item["process"]
            error = item.get("error")
            if process is None:
                if now < item["due"] or any(name == metric["name"] for name, _ in ctx.retired):
                    continue
                try:
                    process = subprocess.Popen(
                        ["/bin/bash", "-c", metric["command"]], stdin=subprocess.DEVNULL,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0, start_new_session=True,
                    )
                    item.update(process=process, streams=[process.stdout, process.stderr],
                                output=bytearray(), size=0, deadline=now + ctx.timeout, error=None)
                    for stream in item["streams"]:
                        os.set_blocking(stream.fileno(), False)
                except OSError as failure:
                    error = str(failure)[:200]
                    if process is None:
                        item["due"] = time.monotonic() + metric["interval_s"]
                        ctx.emit({"t": "metric", "name": metric["name"], "value": None, "error": error})
                        continue
                else:
                    continue
            if error is None:
                try:
                    # Bound each item's work as well as total stdout + stderr bytes.
                    budget = 65536
                    while budget and item["streams"]:
                        ready, _, _ = select.select(item["streams"], [], [], 0)
                        if not ready:
                            break
                        for stream in ready:
                            data = os.read(stream.fileno(), min(budget, ctx.maximum - item["size"] + 1))
                            if not data:
                                item["streams"].remove(stream)
                                stream.close()
                                continue
                            budget -= len(data)
                            item["size"] += len(data)
                            if item["size"] > ctx.maximum:
                                raise ValueError("command output exceeded {} bytes".format(ctx.maximum))
                            if stream is process.stdout:
                                item["output"].extend(data)
                            if not budget:
                                break
                except (OSError, ValueError) as failure:
                    error = str(failure)[:200]
            code = process.poll()
            if error is None and (code is None or item["streams"]) and time.monotonic() >= item["deadline"]:
                error = "command timed out"
            if error is not None:
                item["error"] = error
                stop_process(process)
                code = process.poll()
            if code is None or (error is None and item["streams"]):
                continue
            if error is None and code != 0:
                error = "command exited with status " + str(code)
            value = None
            if error is None:
                try:
                    value = parse_value(item["output"], metric["parse"])
                except (ValueError, TypeError, KeyError, IndexError, OverflowError, RecursionError) as failure:
                    error = str(failure)[:200] or type(failure).__name__
            stop_process(process)
            item["process"] = None
            item["output"] = None
            item["due"] = time.monotonic() + metric["interval_s"]
            ctx.emit({"t": "metric", "name": metric["name"], "value": value, "error": error})

