def consume_body_budget(ctx, path, content):
    size = len(content.encode("utf-8"))
    check_body_budget(ctx, path, size)
    ctx.used += size
    return content

