from ..hashline_limits import _CHUNK


def _text(text):
    if not isinstance(text, str) or "\0" in text:
        raise ValueError("Text must be a UTF-8 string without NUL")
    for start in range(0, len(text), _CHUNK):
        text[start:start + _CHUNK].encode("utf-8")
