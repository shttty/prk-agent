def count_lines(path):
    """(lines, binary) for an untracked file."""
    try:
        if os.path.getsize(path) > MAX_UNTRACKED_BYTES:
            return 0, False
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError:
        return 0, False
    if b"\0" in data:
        return 0, True
    return data.count(b"\n") + (1 if data and not data.endswith(b"\n") else 0), False
