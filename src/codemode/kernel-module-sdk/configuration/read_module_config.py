import sys


def config(module):
    """Return this module's validated defaults plus PRK kernelTools overrides, once per process."""
    root = module.removeprefix("prk_tools.").split(".")[0]
    if root not in _configs:
        package = sys.modules.get("prk_tools." + root)
        if package is None:
            raise ValueError("config() requires an importing prk_tools module")
        _configs[root] = _merge(getattr(package, "DEFAULT_CONFIG", {}), _overrides.get(root, {}), "kernelTools." + root)
    return _configs[root]


