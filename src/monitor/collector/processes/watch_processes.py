def watch_processes(value):
    if not isinstance(value, dict) or any(
        not isinstance(session, str) or not 1 <= len(session) <= 128
        or not isinstance(roots, list) or not 1 <= len(roots) <= PROCESS_ROWS
        or any(type(pid) is not int or not 0 < pid < 2**31 for pid in roots)
        for session, roots in value.items()
    ):
        raise ValueError("Invalid monitor process roots")
    return value
