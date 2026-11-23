def shutdown(ctx):
    with ctx.lock:
        ctx.closed = True
        children = list(ctx.children.values())
        for sha in list(ctx.uploads):
            discard_upload(ctx, sha)
    for child in children:
        terminate_child(child)
    for child in children:
        if child.watcher is not None:
            child.watcher.join(timeout=0.5)
    errors = [child.cleanup_error for child in children if child.cleanup_error]
    if errors:
        raise ValueError("; ".join(errors))

