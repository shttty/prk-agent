def _library_unload():
    namespace = _namespace
    for name, wrapper in _library_wrappers.items():
        if namespace.get(name) is wrapper:
            del namespace[name]


