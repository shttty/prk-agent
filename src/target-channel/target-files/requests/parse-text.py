def _text(value, name, nonempty=False):
    if not isinstance(value, str) or "\0" in value or (nonempty and not value):
        raise ValueError(name + " must be a UTF-8 string without NUL" + (" and cannot be empty" if nonempty else ""))
    value.encode("utf-8")
    return value


