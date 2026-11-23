def _trace_shutdown(ctx):
    # Python audit hooks cannot be removed; leave this retained hook inert.
    ctx.enabled = False
