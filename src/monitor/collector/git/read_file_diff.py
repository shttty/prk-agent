def file_diff(directory, path, request_id):
    reply = {"t": "diff", "id": request_id, "dir": directory, "path": path, "text": "", "truncated": False, "error": None}
    try:
        found = discover(directory)
        if found[0] != "root":
            raise RuntimeError(found[1] or "not a git repository")
        root = found[1]
        full = os.path.join(root, path)
        tracked = git(root, "ls-files", "--error-unmatch", "--", path, check=False).returncode == 0
        if tracked or not os.path.exists(full):
            out = git(root, "diff", "--no-renames", base_rev(root), "--", path)
        else:
            # untracked: exit status 1 means "differs", the expected case
            out = git(root, "diff", "--no-index", "--", os.devnull, full, check=False)
        data = out.stdout[:MAX_DIFF_BYTES + 1]
        reply["truncated"] = len(data) > MAX_DIFF_BYTES
        reply["text"] = data[:MAX_DIFF_BYTES].decode("utf-8", "replace")
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        reply["error"] = str(error)[:200]
    return reply
