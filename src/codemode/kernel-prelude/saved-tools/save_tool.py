from collections.abc import Callable as _Callable
from typing import Any as _Any, Optional as _Optional


def tool(function: _Optional[_Callable[..., _Any]] = None, *, persist: bool = False, reason: _Optional[str] = None) -> _Any:
    """Preinstalled decorator (never import it): @tool(persist=True, reason='future task class') saves a reusable function to shared staging.

    A persisted tool needs a nonblank reason naming the future tasks that will reuse it, must be
    a synchronous function without closures, and cannot reuse a prelude helper's name. Do not
    hand-build source or signature metadata. Distinct native sessions with successful uses can
    auto-promote a tool; manual promotion is human-only. Without persist=True the function
    is returned unchanged.
    """
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


