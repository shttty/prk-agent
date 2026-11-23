def handle(command):
    op, path = _request(command)
    if op == "read":
        return _read(path, command)
    if op == "edit":
        return _edit(path, command)
    return _write(path, command)

