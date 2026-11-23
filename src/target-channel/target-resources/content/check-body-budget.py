def check_body_budget(ctx, path, size):
    if size > ctx.file_limit:
        raise ResourceLimitError(path + ": contextFileBytes limit " + str(ctx.file_limit) + " exceeded")
    if ctx.used + size > ctx.total_limit:
        raise ResourceLimitError(path + ": contextTotalBytes limit " + str(ctx.total_limit) + " exceeded")

