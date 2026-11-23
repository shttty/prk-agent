def _diff(path, before, after):
    old, new = _lines(before), _lines(after)
    head = 0
    while head < min(len(old), len(new)) and old[head] == new[head]:
        head += 1
    tail = 0
    while tail < min(len(old), len(new)) - head and old[-1 - tail] == new[-1 - tail]:
        tail += 1
    start = max(0, head - _CONTEXT)
    old_end = min(len(old), len(old) - tail + _CONTEXT)
    new_end = min(len(new), len(new) - tail + _CONTEXT)
    matcher = difflib.SequenceMatcher(None, old[start:old_end], new[start:new_end])
    display, patch = [], []
    size = 0
    first = None
    width = len(str(max(len(old), len(new), 1)))

    def append(output, text):
        nonlocal size
        size += len(text.encode("utf-8"))
        if size > MAX_RESULT_BYTES:
            raise ValueError("File tool diff/patch exceeds 256 KiB; nothing written")
        output.append(text)

    append(patch, "--- " + path + "\n+++ " + path + "\n")
    for group in matcher.get_grouped_opcodes(_CONTEXT):
        a, b = group[0][1] + start, group[-1][2] + start
        c, d = group[0][3] + start, group[-1][4] + start
        append(patch, "@@ -" + _range(a, b) + " +" + _range(c, d) + " @@\n")
        if display:
            append(display, " " + " " * width + " ...\n")
        for tag, a, b, c, d in group:
            a, b, c, d = a + start, b + start, c + start, d + start
            if tag != "equal" and first is None:
                first = c + 1
            portions = [(" ", old, a, b)] if tag == "equal" else []
            if tag in ("replace", "delete"):
                portions.append(("-", old, a, b))
            if tag in ("replace", "insert"):
                portions.append(("+", new, c, d))
            for prefix, rows, left, right in portions:
                for index in range(left, right):
                    line = rows[index]
                    append(display, prefix + str(index + 1).rjust(width) + " " + (line[:-1] if line.endswith("\n") else line) + "\n")
                    append(patch, prefix + line)
                    if not line.endswith("\n"):
                        append(patch, "\n\\ No newline at end of file\n")
    return {"diff": "".join(display).rstrip("\n"), "patch": "".join(patch), "firstChangedLine": first}


