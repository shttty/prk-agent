def _file_call(name, **args):
    """Return the native file-tool outcome after SDK hooks; no second kernel execute."""
    import json
    if name not in ("read", "edit", "write"):
        raise ValueError("file_call supports read/edit/write only")
    request = {"name": name, "args": args, "result": "file"}
    payload = json.dumps(request, ensure_ascii=False)
    if len(payload.encode("utf-8")) > 1024 * 1024:
        raise ValueError("File callback request exceeds 1 MiB")
    return _host._callback("gateway", request)
