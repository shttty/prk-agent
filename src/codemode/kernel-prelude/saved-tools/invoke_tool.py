def _library_invoke(entry, args, kwargs):
    _library_load(entry)
    available = _library_availability[entry["name"]]
    if not available["available"]:
        raise RuntimeError("Tool " + entry["name"] + " unavailable on this instance: " + available["unavailableReason"])
    return _library_functions[entry["name"]](*args, **kwargs)


