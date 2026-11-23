def read_frontmatter(ctx, path):
    # Read only the header: skill bodies and supporting files stay on the target.
    with open(path, "rb") as source:
        prefix = source.read(3)
        if prefix == b"\xef\xbb\xbf":
            prefix = source.read(3)
        if prefix != b"---":
            return ""
        data = [prefix]
        size = len(prefix)
        check_body_budget(ctx, path, size)
        while True:
            maximum = min(ctx.file_limit, ctx.total_limit - ctx.used) - size
            line = source.readline(maximum + 1)
            size += len(line)
            check_body_budget(ctx, path, size)
            if not line:
                raise ValueError("frontmatter has no closing delimiter")
            if len(data) > 1 and line.startswith(b"---"):
                data.append(b"---\n")
                content = b"".join(data)
                check_body_budget(ctx, path, len(content))
                return consume_body_budget(ctx, path, content.decode("utf-8", "replace"))
            data.append(line)

