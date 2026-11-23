def _edit(path, command):
    metadata = _metadata(path)
    _editable(metadata)
    _check_editors(path)
    with open(path, "rb") as source:
        raw = source.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError("Editable file exceeds 200 MiB; nothing written")
    original = raw.decode("utf-8")
    if "\0" in original:
        raise ValueError("UTF-8 text required; binary/NUL is unsupported")
    before = _normalize(original)
    after = before
    for index, edit in enumerate(command["edits"]):
        old, new = _normalize(edit["oldText"]), _normalize(edit["newText"])
        if not old and after:
            raise ValueError("Empty oldText is allowed only for an empty file; nothing written")
        position = after.find(old)
        if position < 0:
            raise ValueError("edits[" + str(index) + "].oldText did not match; nothing written")
        if after.find(old, position + 1) >= 0:
            raise ValueError("edits[" + str(index) + "].oldText is ambiguous; nothing written")
        after = after[:position] + new + after[position + len(old):]
    if before == after:
        return _result("No changes made to " + path + ".", {"diff": "", "patch": "", "hash": hashlib.sha256(raw).hexdigest(), "path": path})
    bom = _BOM if raw.startswith(_BOM) else b""
    data = bom + after.replace("\n", _ending(original)).encode("utf-8")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("Edited file exceeds 200 MiB; nothing written")
    details = _diff(path, before, after)
    details.update({"hash": hashlib.sha256(data).hexdigest(), "path": path})
    result = _result("Successfully replaced " + str(len(command["edits"])) + " block(s) in " + path + ".", details)
    _atomic(path, data, metadata)
    return result


