def finish_upload(ctx, command):
    sha = asset_sha(command.get("sha256"))
    asset = ctx.assets.get(sha)
    if asset is None:
        raise ValueError("assetBegin is required before assetFinish")
    try:
        if not verify_cached_asset(ctx, asset):
            raise ValueError("environment artifact was not installed or failed SHA-256 verification")
        return {"path": asset["path"]}
    finally:
        discard_upload(ctx, sha)

