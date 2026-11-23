def _call(ctx, name, **args):
    """Call an enabled Gateway tool through the owning cell's normal callback channel."""
    return ctx._host.gateway.call(name, args)
