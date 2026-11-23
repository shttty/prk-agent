def _metadata(path, missing=False):
    try:
        metadata = os.stat(path)
    except FileNotFoundError:
        if missing:
            return None
        raise
    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError("A regular file is required: " + path)
    return metadata


