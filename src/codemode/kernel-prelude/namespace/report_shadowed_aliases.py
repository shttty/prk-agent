_shadow_reported = set()


def _report_shadowed_aliases():
    """After a cell, say once per overwrite which preinstalled names the user namespace no longer holds."""
    shadowed = []
    for name in _exports:
        if _namespace.get(name) is globals().get(name):
            _shadow_reported.discard(name)
        elif name not in _shadow_reported:
            _shadow_reported.add(name)
            shadowed.append(name)
    if not shadowed:
        return
    names = ", ".join("`" + name + "`" for name in sorted(shadowed))
    if len(shadowed) == 1:
        _write("stdout", "[PRK] " + names + " was overwritten or deleted; the preinstalled function is still `__prk__." + shadowed[0] + "(...)`.\n")
    else:
        _write("stdout", "[PRK] " + names + " were overwritten or deleted; the preinstalled functions are still `__prk__.<name>(...)`.\n")
