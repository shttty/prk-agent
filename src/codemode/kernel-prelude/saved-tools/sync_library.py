def library_sync():
    """Refresh active saved tools, signatures, docstrings and target import availability."""
    tools = _library_apply(_library_call("prk_library_access")["tools"])
    _library_call("prk_library_available", {"tools": list(_library_availability.values())})
    return tools


