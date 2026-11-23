import importlib
import inspect
import sys
import types


def install(payload, host, sdk_source):
    sdk = sys.modules.get("prk_tool")
    if sdk is None:
        sdk = types.ModuleType("prk_tool")
        sys.modules["prk_tool"] = sdk
        exec(compile(sdk_source, "<prk_tool SDK>", "exec"), sdk.__dict__)
    sdk._host = host
    sdk._overrides = payload["config"]
    # A same-process prelude reinstall rebinds the host, not the modules or their sessions.
    for entry in payload["modules"]:
        _roots[entry["name"]] = entry
        _specs.update(entry["sources"])
    for name in sorted(_roots):
        if name in _errors:
            continue
        try:
            importlib.import_module("prk_tools." + name)
        except (Exception, SystemExit) as error:
            _errors[name] = type(error).__name__ + ": " + str(error)
            for imported in list(sys.modules):
                if imported == "prk_tools." + name or imported.startswith("prk_tools." + name + "."):
                    del sys.modules[imported]
            _package.__dict__.pop(name, None)
    catalog = []
    # Legacy helpers also use inspect after load. Static metadata is only a cold-start manifest.
    for name, function in host._helper_functions.items():
        if function.__module__.startswith("prk_tools."):
            continue
        catalog.append({"name": name, "signature": str(inspect.signature(function)),
                        "description": (inspect.getdoc(function) or "").split("\n")[0],
                        "source": "PRK kernel prelude", "available": True})
    for name, entry in sorted(_roots.items()):
        metadata = {"module": name, "source": entry["path"], "overridesBuiltin": entry["overridesBuiltin"],
                    "dependencies": entry["dependencies"]}
        if name not in _errors:
            module = sys.modules["prk_tools." + name]
            functions = [(key, value) for key, value in vars(module).items()
                         if not key.startswith("_") and inspect.isfunction(value) and getattr(value, "__prk_tool__", False)
                         and (value.__module__ == module.__name__ or value.__module__.startswith(module.__name__ + "."))]
            conflicts = [key for key, function in functions
                         if (key in host._helper_functions and host._helper_functions[key] is not function)
                         or key in host._library_entries or key == "gateway"]
            if conflicts:
                _errors[name] = "Exported tool name conflicts with another module or legacy helper: " + ", ".join(conflicts)
            else:
                rows = []
                try:
                    for key, function in functions:
                        rows.append({**metadata, "name": key, "signature": str(inspect.signature(function)),
                                     "description": (inspect.getdoc(function) or "").split("\n")[0], "available": True})
                except (TypeError, ValueError) as error:
                    _errors[name] = str(error)
                else:
                    for key, function in functions:
                        host._helper_functions[key] = function
                        setattr(host, key, function)
                        if key not in host._exports:
                            host._exports.append(key)
                    catalog.extend(rows)
                    if not functions:
                        catalog.append({**metadata, "name": "module:" + name, "signature": "",
                                        "description": "Public library module (no exported tools)", "moduleOnly": True, "available": True})
        if name in _errors:
            catalog.append({**metadata, "name": "module:" + name, "signature": "", "description": "Module unavailable",
                            "available": False, "error": _errors[name]})
    return catalog
