def discard_upload(ctx, sha):
    upload = ctx.uploads.pop(sha, None)
    if upload is not None:
        for path in (upload["temporary"], upload["install"]):
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass

