def _library_load(entry):
    name = entry["name"]
    if _library_entries.get(name, {}).get("version") == entry["version"] and _library_availability.get(name, {}).get("available"):
        return
    namespace = {key: globals()[key] for key in _exports if key in globals()}
    namespace.update({"__name__": "_prk_saved_" + name})
    try:
        compiler_flags = 0
        for statement in entry["imports"]:
            parsed = _library_ast.parse(statement)
            if any(isinstance(item, _library_ast.ImportFrom) and item.module == "__future__" and any(alias.name == "annotations" for alias in item.names) for item in parsed.body):
                compiler_flags |= _library_future.annotations.compiler_flag
            exec(compile(parsed, "<PRK tool imports: " + name + ">", "exec"), namespace)
        exec(compile(entry["source"], "<PRK tool: " + name + ">", "exec", flags=compiler_flags, dont_inherit=True), namespace)
        _library_functions[name] = namespace[name]
        _library_availability[name] = {"name": name, "version": entry["version"], "available": True}
    except ImportError as error:
        _library_functions.pop(name, None)
        _library_availability[name] = {"name": name, "version": entry["version"], "available": False,
                                       "unavailableReason": str(error)}
    _library_entries[name] = entry
    if name not in _library_wrappers:
        def invoke(*args, **kwargs):
            _helper_functions["library_sync"]()
            current = _library_entries.get(name)
            if current is None:
                raise RuntimeError("Library tool " + name + " is disabled, archived or deleted")
            result = _library_invoke(current, args, kwargs)
            _library_call("prk_library_used", {"name": name, "version": current["version"]})
            return result
        invoke.__name__ = name
        _library_wrappers[name] = invoke
    wrapper = _library_wrappers[name]
    wrapper.__doc__ = entry["docstring"]
    if name in _library_functions:
        wrapper.__signature__ = _library_inspect.signature(_library_functions[name])
    globals()[name] = wrapper
    _namespace[name] = wrapper
    if name not in _exports:
        _exports.append(name)


