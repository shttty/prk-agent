def sample_cpu(ctx):
    now = read_cpu_times(ctx)
    prev, ctx.prev_cpu = ctx.prev_cpu, now
    if not now:
        return {"pct": None, "cores": 0}
    pct = None
    if prev and now[0] > prev[0]:
        pct = round(100.0 * (1 - (now[1] - prev[1]) / (now[0] - prev[0])), 1)
    return {"pct": pct, "cores": now[2]}
