def registration_versions(command):
    unknown = set(command) - {"id", "mod", "op", "paths", "settings"}
    if unknown:
        raise ValueError("unknown registration field: " + sorted(unknown)[0])
    paths = command.get("paths")
    settings = command.get("settings")
    if not isinstance(paths, list) or not isinstance(settings, list) or len(paths) + len(settings) > 4096:
        raise ValueError("registration paths must contain at most 4096 entries")
    for path in paths + settings:
        absolute_path(path)
    if len(json.dumps([paths, settings], ensure_ascii=False).encode("utf-8")) > DEFAULT_CONTEXT_TOTAL_BYTES:
        raise ValueError("registration paths exceed the 256 KiB request budget")
    versions = []
    for path in paths:
        try:
            status = os.stat(path)
            version = str(status.st_mtime_ns) + ":" + str(status.st_size)
        except FileNotFoundError:
            version = "missing"
        versions.append([path, version])
    for path in settings:
        try:
            with open(path, "rb") as source:
                body = source.read(DEFAULT_CONTEXT_TOTAL_BYTES + 1)
            if len(body) > DEFAULT_CONTEXT_TOTAL_BYTES:
                raise ValueError("registration settings exceed the 256 KiB read budget: " + path)
            document = json.loads(body)
            if not isinstance(document, dict):
                raise ValueError("registration settings must be an object: " + path)
        except FileNotFoundError:
            document = {}
        version = json.dumps([document.get(name) for name in ("packages", "extensions", "skills")], sort_keys=True, separators=(",", ":"))
        versions.append(["settings:" + path, version])
    reply = {"versions": versions}
    if len(json.dumps(reply, ensure_ascii=False).encode("utf-8")) > DEFAULT_CONTEXT_TOTAL_BYTES:
        raise ValueError("registration versions exceed the 256 KiB response budget")
    return reply
