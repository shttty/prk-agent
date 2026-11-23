def verify_cached_asset(ctx, asset):
    path = asset["blob"]
    try:
        signature = file_signature(path)
        if signature[0] != asset["size"]:
            return False
        if ctx.verified.get(path) != signature:
            if file_sha256(path) != asset["sha256"]:
                return False
            ctx.verified[path] = signature
    except OSError:
        return False
    if asset["kind"] in ("binary", "tool"):
        if not os.access(path, os.X_OK):
            os.chmod(path, 0o555)
            ctx.verified[path] = file_signature(path)
        if not os.access(path, os.X_OK):
            raise ValueError("remote extension artifact is not executable: " + path)
    elif not os.path.isdir(asset["path"]):
        publish_bundle(ctx, asset)
    return True

