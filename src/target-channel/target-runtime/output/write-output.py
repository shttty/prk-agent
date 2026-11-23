def write_output(outgoing, stopping):
    while True:
        data = outgoing.get()
        if data is None:
            return
        remaining = memoryview(data)
        try:
            while remaining:
                written = os.write(1, remaining)
                if not written:
                    stopping.set()
                    return
                remaining = remaining[written:]
        except OSError:
            stopping.set()
            return


