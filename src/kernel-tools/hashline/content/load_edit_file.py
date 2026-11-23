import os
from ..hashline_limits import _BOM
from .check_encoding import _check_encoding
from .split_lines import _split


def _load(path, maximum):
    with open(path, "rb") as stream:
        metadata = os.fstat(stream.fileno())
        if metadata.st_size > maximum:
            raise ValueError(f"edit is limited to {maximum} bytes; use bash/Python for larger files")
        data = stream.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError(f"edit is limited to {maximum} bytes; use bash/Python for larger files")
    _check_encoding(data)
    bom = _BOM if data.startswith(_BOM) else b""
    return data, bom, _split(data[len(bom):].decode("utf-8")), metadata
