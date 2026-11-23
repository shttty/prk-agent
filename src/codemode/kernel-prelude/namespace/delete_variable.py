import gc as _ns_gc


def delete_variable(name):
    if not _namespace_user_name(name):
        raise ValueError("Only an exact user variable name may be deleted; helpers and internal names are excluded.")
    if name not in _namespace:
        raise KeyError("User variable does not exist: " + name)
    del _namespace[name]
    _ns_gc.collect()


