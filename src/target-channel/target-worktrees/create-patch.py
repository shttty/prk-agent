def create_worktree_patch(command):
    repo, root = command["repoRoot"], command["worktreeRoot"]
    if worktree_parent_state(repo) != command["parentState"]:
        raise ValueError("Parent checkout changed since isolation began; session_result refused. Inspect the parent repository before submitting again.")
    destination = command["path"]
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="prk-index-") as directory:
        env = {"GIT_INDEX_FILE": os.path.join(directory, "index")}
        base = command["baseCommit"]
        worktree_git(root, "read-tree", base, env=env)
        worktree_git(root, "add", "-A", env=env)
        stats = worktree_git(root, "diff", "--cached", "--stat", base, env=env).decode("utf-8", "replace")
        if len(stats.encode()) > 64 * 1024:
            raise ValueError("Patch stats exceed the 64 KiB result limit.")
        descriptor, temporary = tempfile.mkstemp(prefix=".prk-patch-", dir=os.path.dirname(destination))
        try:
            with os.fdopen(descriptor, "wb") as output:
                worktree_git(root, "diff", "--cached", "--binary", base, env=env, output=output)
            size = os.path.getsize(temporary)
            if size > PATCH_MAX_BYTES:
                raise ValueError("Binary patch exceeds the 16 MiB artifact limit; reduce the changed files before submitting.")
            if not size:
                return {}
            os.replace(temporary, destination)
            return {"path": destination, "bytes": size, "stats": stats}
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
