def _check_editors(path):
    directory, name = os.path.split(path)
    # Vim block0: portable LE pid [24:28], hostname [68:108]. Adjacent
    # swap suffixes descend .swp through .saa; hidden names gain no extra dot.
    # https://github.com/vim/vim/blob/v9.1.0000/src/memline.c
    prefix = (name if name.startswith(".") else "." + name) + "."
    with os.scandir(directory) as entries:
        for entry in entries:
            if not entry.name.startswith(prefix):
                continue
            suffix = entry.name[len(prefix):]
            if not re.fullmatch(r"s[a-z][a-z]", suffix) or not "saa" <= suffix <= "swp":
                continue
            try:
                if not entry.is_file():
                    continue
                with open(entry.path, "rb") as stream:
                    header = stream.read(108)
            except OSError:
                continue
            if len(header) < 108 or header[:1] != b"b" or header[1:2] not in (b"0", b"c", b"C", b"d", b"S", b"s") or header[2:6] != b"VIM ":
                continue
            host = header[68:108].split(b"\0", 1)[0].decode("utf-8", "replace")
            if _local_host(host) and _alive(int.from_bytes(header[24:28], "little")):
                raise ValueError("File is being edited by vim: " + path)
    try:
        owner = os.readlink(os.path.join(directory, ".#" + name))
    except OSError:
        return
    match = re.fullmatch(r"[^@]+@(.+)\.([0-9]+)(?::.*)?", owner)
    if match and _local_host(match[1]) and _alive(int(match[2])):
        raise ValueError("File is being edited by emacs: " + path)


