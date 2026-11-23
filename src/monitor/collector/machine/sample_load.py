def sample_load(ctx):
    try:
        return [float(x) for x in read_proc_file(ctx, "loadavg").split()[:3]]
    except (OSError, ValueError):
        return None
