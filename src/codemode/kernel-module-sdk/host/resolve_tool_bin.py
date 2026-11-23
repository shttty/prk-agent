def _tool_bin(ctx, name):
    """Resolve a sha256-verified binary using PRK's existing artifact transport/cache."""
    return ctx._host._helper_functions["tool_bin"](name)
