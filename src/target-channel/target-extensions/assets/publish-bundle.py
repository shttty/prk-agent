def publish_bundle(ctx, asset):
    directory = os.path.dirname(asset["path"])
    os.makedirs(directory, mode=0o700, exist_ok=True)
    temporary = tempfile.mkdtemp(prefix=".bundle-", dir=directory)
    try:
        extract_bundle(asset["blob"], temporary)
        try:
            os.rename(temporary, asset["path"])
        except OSError:
            if not os.path.isdir(asset["path"]):
                raise
    finally:
        remove_directory(temporary)

