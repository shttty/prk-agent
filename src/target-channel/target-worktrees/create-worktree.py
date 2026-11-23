def create_worktree(command):
    cwd = command["cwd"]
    try:
        repo = worktree_git(cwd, "rev-parse", "--show-toplevel").decode().strip()
        base = worktree_git(cwd, "rev-parse", "HEAD").decode().strip()
    except ValueError as error:
        raise ValueError("Isolated child requires a git repository with a HEAD commit; pass isolated: false to disable isolation. " + str(error)) from error
    relative = os.path.relpath(os.path.realpath(cwd), repo)
    root = os.path.join(os.path.expanduser("~"), ".cache", "prk-worktrees", command["sessionId"])
    parent_state = worktree_parent_state(repo)
    os.makedirs(os.path.dirname(root), exist_ok=True)
    worktree_git(repo, "worktree", "add", "--detach", root, base)
    actual_cwd = os.path.normpath(os.path.join(root, relative))
    if not os.path.isdir(actual_cwd):
        worktree_git(repo, "worktree", "remove", "--force", root)
        raise ValueError("The selected cwd is not present in the HEAD commit; pass isolated: false or commit the directory first.")
    return {"isolated": True, "repoRoot": repo, "worktreeRoot": root,
            "baseCommit": base, "parentState": parent_state, "cwd": actual_cwd}
