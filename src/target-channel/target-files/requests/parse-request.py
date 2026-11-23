def _request(command):
    op = command.get("op")
    fields = {"read": {"offset", "limit"}, "edit": {"edits"}, "write": {"content"}}
    if op not in fields:
        raise ValueError("unknown files operation: " + str(op))
    allowed = {"id", "mod", "op", "cwd", "path"} | fields[op]
    if set(command) - allowed:
        raise ValueError("unknown files request field")
    payload = {key: value for key, value in command.items() if key not in ("id", "mod", "op")}
    if _json_bytes(payload) > MAX_REQUEST_BYTES:
        raise ValueError("File tool request exceeds 1 MiB; nothing written")
    cwd = _text(command.get("cwd"), "cwd", True)
    if not os.path.isabs(cwd):
        raise ValueError("cwd must be absolute")
    path = _text(command.get("path"), "path", True)
    if op == "read":
        for key, maximum in (("offset", 9007199254740991), ("limit", MAX_READ_LINES)):
            value = command.get(key, 1 if key == "offset" else MAX_READ_LINES)
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError(key + " must be a positive integer at most " + str(maximum))
    elif op == "edit":
        edits = command.get("edits")
        if not isinstance(edits, list) or not edits:
            raise ValueError("edits must contain at least one replacement")
        for edit in edits:
            if not isinstance(edit, dict) or set(edit) != {"oldText", "newText"}:
                raise ValueError("each edit requires only oldText and newText")
            _text(edit["oldText"], "oldText")
            _text(edit["newText"], "newText")
    else:
        _text(command.get("content"), "content")
    path = os.path.expanduser(path)
    return op, os.path.realpath(path if os.path.isabs(path) else os.path.join(cwd, path))


