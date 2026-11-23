from types import MappingProxyType


def _merge(defaults, overrides, path):
    if not isinstance(defaults, dict) or not isinstance(overrides, dict):
        raise TypeError(path + " must be a configuration object")
    unknown = overrides.keys() - defaults.keys()
    if unknown:
        raise ValueError(path + ": unknown configuration keys: " + ", ".join(sorted(unknown)))
    result = {}
    for key, default in defaults.items():
        if type(key) is not str:
            raise TypeError(path + " configuration keys must be strings")
        _freeze(default, path + "." + key)
        value = overrides.get(key, default)
        if isinstance(default, dict):
            value = _merge(default, value, path + "." + key)
        elif type(value) is not type(default):
            raise TypeError(path + "." + key + " must have type " + type(default).__name__)
        result[key] = value if isinstance(default, dict) else _freeze(value, path + "." + key)
    return MappingProxyType(result)


