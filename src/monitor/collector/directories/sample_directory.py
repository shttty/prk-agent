def dir_sample(directory):
    out = {"t": "dir", "dir": directory, "git": False, "added": 0, "removed": 0, "files": [],
           "truncated": False, "disk": disk_of(resolve(directory)), "error": None, "reason": None, "unavailable": False}
    found = discover(directory)
    if found[0] != "root":
        # Not a work tree for git itself (or git cannot answer): the Gateway falls back to the agent's own edits.
        out["reason"], out["unavailable"] = found[1], found[2]
        return out
    out["git"] = True
    try:
        files, truncated = git_changes(found[1])
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        out["error"] = str(error)[:200]
        return out
    # totals cover the listed files; a capped listing is flagged `truncated`
    out.update(files=files, truncated=truncated,
               added=sum(f["added"] for f in files), removed=sum(f["removed"] for f in files))
    return out
