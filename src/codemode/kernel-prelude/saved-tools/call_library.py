def _library_call(name, args=None):
    return _callback("library", {"name": name, "args": args or {}})


