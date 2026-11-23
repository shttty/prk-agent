import inspect as _ns_inspect


def _namespace_descriptor(name, value):
    entry = {"name": name, "type": type(value).__name__}
    if _ns_inspect.isfunction(value) or _ns_inspect.ismethod(value):
        try:
            entry["signature"] = str(_ns_inspect.signature(value))
        except (TypeError, ValueError):
            pass
        doc = _ns_inspect.getdoc(value)
        if doc:
            entry["docstring"] = doc.splitlines()[0][:_ns_options["docstringChars"]]
    return entry


