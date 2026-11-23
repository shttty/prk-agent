def read(command):
    path = absolute_path(command.get("path"))
    maximum = command.get("maxBytes", DEFAULT_MAX_BYTES)
    if maximum is not None and (type(maximum) is not int or maximum < 0):
        raise ValueError("maxBytes must be a nonnegative integer or null")
    with open(path, "rb") as source:
        data = source.read() if maximum is None else source.read(maximum + 1)
    truncated = maximum is not None and len(data) > maximum
    if truncated:
        data = data[:maximum]
    return {"data": base64.b64encode(data).decode("ascii"), "truncated": truncated}


