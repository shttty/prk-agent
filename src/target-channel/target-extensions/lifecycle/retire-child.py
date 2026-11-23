def retire_child(ctx, child):
    with ctx.lock:
        if child.terminated and ctx.children.get(child.generation) is child:
            del ctx.children[child.generation]

