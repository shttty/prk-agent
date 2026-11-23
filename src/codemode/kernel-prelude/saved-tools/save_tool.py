def tool(function=None, *, persist=False, reason=None):
    """@tool(persist=True, reason="future tasks") saves inspected functions to shared staging."""
    def decorate(candidate):
        if not persist:
            return candidate
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError("Persisted tools require a nonblank reason describing future tasks that will reuse them.")
        metadata = _library_metadata(candidate)
        metadata["reason"] = reason.strip()
        entry = _library_call("prk_library_save", metadata)["tool"]
        if entry["status"] == "archived":
            return candidate
        _helper_functions["library_sync"]()
        if entry["name"] not in _library_entries:
            raise RuntimeError("Library tool " + entry["name"] + " is disabled, archived or deleted")
        return _library_wrappers[entry["name"]]
    return decorate if function is None else decorate(function)


