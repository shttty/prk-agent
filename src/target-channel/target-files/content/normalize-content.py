def _normalize(value):
    return (value[1:] if value.startswith("\ufeff") else value).replace("\r\n", "\n")


