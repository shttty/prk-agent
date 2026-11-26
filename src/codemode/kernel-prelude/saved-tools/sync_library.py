from typing import Any as _Any


def library_sync() -> list[dict[str, _Any]]:
    """Reload the saved tools into this kernel and return their entries; call a loaded tool directly, never through gateway.call('prk_saved_...').

    Refreshes names, signatures, docstrings and target import availability of the active saved
    tools. They also load at kernel startup. Calling one through gateway.call would need a second
    execution while this kernel is busy, so call the loaded Python function in the current cell.
    """
    tools = _library_apply(_library_call("prk_library_access")["tools"])
    _library_call("prk_library_available", {"tools": list(_library_availability.values())})
    return tools


