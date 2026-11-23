def _write(path, command):
    metadata = _metadata(path, missing=True)
    _editable(metadata)
    # Missing parents are created only after every payload/result admission check.
    if os.path.isdir(os.path.dirname(path)):
        _check_editors(path)
    content = command["content"]
    if metadata is not None:
        bom, ending = b"", "\n"
        with open(path, "rb") as source:
            first = True
            previous = b""
            while True:
                chunk = source.readline(8192)
                if first:
                    bom = _BOM if chunk.startswith(_BOM) else b""
                    if b"\0" in chunk:
                        raise ValueError("UTF-8 text required; binary/NUL is unsupported")
                    first = False
                if not chunk:
                    break
                if chunk.endswith(b"\n"):
                    ending = "\r\n" if (previous + chunk).endswith(b"\r\n") else "\n"
                    break
                previous = chunk[-1:]
        data = bom + _normalize(content).replace("\n", ending).encode("utf-8")
    else:
        data = content.encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("Written file exceeds 200 MiB; nothing written")
    details = {"hash": hashlib.sha256(data).hexdigest(), "path": path}
    result = _result("Successfully wrote " + str(len(data)) + " bytes to " + path + ".", details)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    _atomic(path, data, metadata)
    return result


