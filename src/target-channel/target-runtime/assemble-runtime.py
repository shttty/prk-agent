def main():
    outgoing = queue.Queue(maxsize=8)
    stopping = threading.Event()
    closers = []
    writer = threading.Thread(target=write_output, args=(outgoing, stopping), daemon=True)
    writer.start()
    modules = {}
    readiness = []
    started = threading.Event()
    for name, source in MODULE_SOURCES.items():
        incoming = queue.Queue(maxsize=PROCESS_LIMITS["maxRequests"])
        modules[name] = incoming
        ready = threading.Event()
        readiness.append(ready)
        threading.Thread(target=run_module, args=(name, source, incoming, outgoing, ready, started, closers), daemon=True).start()
    try:
        serve(modules, outgoing, readiness, started, stopping)
    finally:
        for close in closers:
            close()
        try:
            outgoing.put_nowait(None)
        except queue.Full:
            pass
        writer.join(timeout=0.2)
    # A module may be blocked in git or another syscall; daemon threads must not delay exit.
    os._exit(0)


if __name__ == "__main__":
    main()
