def begin_upload(ctx, command, check_only=False):
    sha = asset_sha(command.get("sha256"))
    size = command.get("size")
    kind = command.get("kind")
    if type(size) is not int or size < 0 or size > 9007199254740991:
        raise ValueError("asset size must be a nonnegative safe integer")
    if kind not in ("binary", "tar", "tool"):
        raise ValueError("asset kind must be binary, tar, or tool")
    name = command.get("name") if kind == "tool" else None
    if kind == "tool" and (not isinstance(name, str) or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,127}", name) is None):
        raise ValueError("invalid remote extension tool name")
    previous = ctx.assets.get(sha)
    if previous is not None and (previous["size"] != size or previous["kind"] != kind):
        raise ValueError("asset sha256 already has different metadata")
    blob = os.path.join(ctx.cache_root, "bin", sha, name) if kind == "tool" else os.path.join(ctx.root, kind, sha)
    asset = {"sha256": sha, "size": size, "kind": kind, "blob": blob,
             "path": os.path.join(ctx.root, "bundle", sha) if kind == "tar" else blob}
    ctx.assets[sha] = asset
    if verify_cached_asset(ctx, asset):
        return {"cached": True, "path": asset["path"]}
    if check_only:
        return {"cached": False, "path": asset["path"]}
    if sha not in ctx.uploads:
        os.makedirs(os.path.dirname(blob), mode=0o700, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".upload-", dir=os.path.dirname(blob))
        os.close(fd)
        ctx.uploads[sha] = {"temporary": temporary, "install": temporary + ".install"}
        try:
            with open(ctx.uploads[sha]["install"], "xb"):
                pass
        except BaseException:
            discard_upload(ctx, sha)
            raise
    return {"cached": False, "path": asset["path"], "blob": blob, "uploadPath": ctx.uploads[sha]["temporary"]}

