def _namespace_user_name(name):
    return (isinstance(name, str) and name.isidentifier()
            and name != "_prk" and not name.startswith("_prk_")
            and name not in ("_", "__", "___") and _ns_history_name.fullmatch(name) is None
            and name not in _exports and name not in _helper_functions
            and name not in ("__builtins__", "__name__", "display", "exit", "quit"))


