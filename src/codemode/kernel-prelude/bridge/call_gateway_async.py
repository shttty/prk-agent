async def _gateway_call_async(ctx, name, args=None):
    """Call a Gateway tool by name without blocking the Python event loop."""
    from _prk_runtime import callback_async

    return await callback_async("gateway", {"name": name, "args": args or {}})
