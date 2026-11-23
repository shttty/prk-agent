def stop(ctx, generation):
    with ctx.lock:
        if generation not in ctx.generations:
            raise ValueError("remote extension generation is not owned by this module")
        child = ctx.children.get(generation)
    if child is not None:
        terminate_child(child)
        if child.watcher is not None:
            child.watcher.join(timeout=0.5)
        retire_child(ctx, child)
        if child.cleanup_error:
            raise ValueError(child.cleanup_error)
    return {}

