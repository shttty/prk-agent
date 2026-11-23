def _read(path, command):
    _metadata(path)
    offset = command.get("offset", 1)
    limit = command.get("limit", MAX_READ_LINES)
    # Reserve room for a continuation notice, and never allocate a whole long line.
    budget = MAX_READ_BYTES - 256
    pieces = []
    lines = 0
    partial = False
    with open(path, "rb") as source:
        skipped = 0
        while skipped < offset - 1:
            chunk = source.readline(8192)
            if not chunk:
                raise ValueError("offset is beyond the end of the file")
            if chunk.endswith(b"\n"):
                skipped += 1
        while lines < limit and budget > 0:
            chunk = source.readline(budget + 1)
            if not chunk:
                break
            if len(chunk) > budget:
                pieces.append(chunk[:budget])
                partial = True
                break
            pieces.append(chunk)
            budget -= len(chunk)
            lines += 1
            if not chunk.endswith(b"\n"):
                break
        truncated = partial or bool(source.read(1))
    data = b"".join(pieces)
    if offset == 1 and data.startswith(_BOM):
        data = data[len(_BOM):]
    if b"\0" in data:
        raise ValueError("UTF-8 text required; binary/NUL is unsupported")
    text = codecs.getincrementaldecoder("utf-8")("strict").decode(data, final=not partial).replace("\r\n", "\n")
    if truncated:
        notice = ("Read output limited within line " + str(offset + lines) + "; inspect that line with a target-side command."
                  if partial else "Read output limited; continue with offset=" + str(offset + lines) + ".")
        text += "\n[" + notice + "]"
    return _result(text, {"path": path})


