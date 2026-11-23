import math
from types import MappingProxyType


def _freeze(value, path):
    if value is None or type(value) in (str, bool, int):
        return value
    if type(value) is float and math.isfinite(value):
        return value
    if type(value) is list:
        return tuple(_freeze(item, path) for item in value)
    if type(value) is dict and all(type(key) is str for key in value):
        return MappingProxyType({key: _freeze(item, path + "." + key) for key, item in value.items()})
    raise TypeError(path + " must contain only finite JSON configuration values")


