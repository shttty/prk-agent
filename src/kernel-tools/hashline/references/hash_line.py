from ..hashline_limits import _CHUNK
from .create_salted_hash import _base
from .read_hash_digest import _digest


def _hash(path, text):
    value = _base(path)
    for start in range(0, len(text), _CHUNK):
        value.update(text[start:start + _CHUNK].encode("utf-8"))
    return _digest(value)
