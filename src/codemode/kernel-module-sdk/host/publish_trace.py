def _trace(ctx, operation, *args):
    """Publish an explicit operation record through the prelude trace, which owns per-cell state and budget."""
    ctx._host._trace.publish("prk.tool", operation, args)
