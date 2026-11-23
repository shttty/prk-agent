def sample_memory(ctx):
    try:
        values = {}
        for line in read_proc_file(ctx, "meminfo").splitlines():
            key, _, rest = line.partition(":")
            if key in ("MemTotal", "MemAvailable"):
                values[key] = int(rest.split()[0]) * 1024
        return {"total": values["MemTotal"], "available": values["MemAvailable"]}
    except (OSError, ValueError, KeyError):
        return None
