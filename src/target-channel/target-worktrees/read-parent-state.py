def worktree_parent_state(repo):
    digest = hashlib.sha256()
    for args in (("rev-parse", "HEAD"), ("status", "--porcelain=v1", "-z"), ("diff", "--binary", "HEAD")):
        digest.update(worktree_git(repo, *args))
        digest.update(b"\0")
    for name in worktree_git(repo, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0"):
        if not name:
            continue
        path = os.path.join(os.fsencode(repo), name)
        digest.update(name + b"\0")
        if os.path.islink(path):
            digest.update(os.readlink(path))
        elif os.path.isfile(path):
            with open(path, "rb") as source:
                while True:
                    chunk = source.read(65536)
                    if not chunk:
                        break
                    digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()
