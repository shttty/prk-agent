def _library_apply(entries):
    active = {entry["name"] for entry in entries}
    for name in list(_library_entries):
        if name not in active:
            wrapper = _library_wrappers.pop(name, None)
            if _namespace.get(name) is wrapper:
                del _namespace[name]
            globals().pop(name, None)
            _library_entries.pop(name, None)
            _library_functions.pop(name, None)
            _library_availability.pop(name, None)
            if name in _exports:
                _exports.remove(name)
    for entry in entries:
        _library_load(entry)
    return [{**entry, **_library_availability[entry["name"]]} for entry in entries]


