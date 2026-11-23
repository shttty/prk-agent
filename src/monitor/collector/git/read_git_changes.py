def git_changes(root):
    """Uncommitted changes vs HEAD (staged + unstaged + untracked). Returns (files, truncated)."""
    numstat = {}
    # `-z` numstat records, without renames: "<add>\t<del>\t<path>\0"
    for record in git(root, "diff", "--no-renames", "--numstat", "-z", base_rev(root)).stdout.split(b"\0"):
        if not record:
            continue
        added, removed, path = record.decode("utf-8", "replace").split("\t", 2)
        numstat[path] = (None, None) if added == "-" else (int(added), int(removed))
    entries = []
    for record in git(root, "status", "--porcelain=v1", "-z", "--no-renames", "-uall").stdout.split(b"\0"):
        if len(record) >= 4 and record[:2] != b"!!":
            entries.append((record[:2].decode("ascii", "replace"), record[3:].decode("utf-8", "replace")))
    entries.sort(key=lambda item: item[1])
    files = []
    for code, path in entries[:MAX_FILES]:
        if code == "??":
            lines, binary = count_lines(os.path.join(root, path))
            files.append({"path": path, "status": "?", "added": lines, "removed": 0, "binary": binary})
        else:
            added, removed = numstat.get(path, (0, 0))
            mark = "D" if "D" in code else "A" if "A" in code else "M"
            files.append({"path": path, "status": mark, "added": added or 0, "removed": removed or 0, "binary": added is None})
    return files, len(entries) > MAX_FILES
