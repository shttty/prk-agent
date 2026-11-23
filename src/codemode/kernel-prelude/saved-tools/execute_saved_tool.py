def library_execute(payload):
    """Idle SDK tool execution uses the existing owned client; host records success after completion."""
    _helper_functions["library_sync"]()
    current = _library_entries.get(payload["entry"]["name"])
    if current is None or current["version"] != payload["entry"]["version"]:
        raise RuntimeError("Library tool is disabled, archived or no longer the current version")
    try:
        result = _library_invoke(current, payload["args"], payload["kwargs"])
    finally:
        _library_call("prk_library_available", {"tools": list(_library_availability.values())})
    if result is not None:
        _write("stdout", repr(result) + "\n")


