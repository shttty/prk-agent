def read_body(ctx, path, charge=True):
    maximum = min(ctx.file_limit, ctx.total_limit - ctx.used + 3) if charge else ctx.file_limit
    with open(path, "rb") as source:
        data = source.read(maximum + 1)
    if len(data) > ctx.file_limit:
        raise ResourceLimitError(path + ": contextFileBytes limit " + str(ctx.file_limit) + " exceeded")
    content = data.decode("utf-8-sig", "replace")
    return consume_body_budget(ctx, path, content) if charge else content

