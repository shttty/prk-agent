def shadowed_context(cwd, bodies, scans):
    # Match Pi findGitPaths and nested-linked-worktree shadowing, not git CLI output.
    directory = cwd
    while True:
        git_path = os.path.join(directory, ".git")
        if os.path.exists(git_path):
            try:
                if os.path.isfile(git_path):
                    pointer = read_body(bodies, git_path, False).strip()
                    if pointer.startswith("gitdir: "):
                        git_dir = os.path.abspath(os.path.join(directory, pointer[8:].strip()))
                        if not os.path.exists(os.path.join(git_dir, "HEAD")):
                            return None
                        common_path = os.path.join(git_dir, "commondir")
                        common_dir = os.path.abspath(os.path.join(git_dir, read_body(bodies, common_path, False).strip())) if os.path.exists(common_path) else git_dir
                        common_dir = canonical_path(common_dir)
                        worktree_root = canonical_path(directory)
                        main_root = os.path.dirname(common_dir)
                        if not worktree_root.startswith(main_root + os.sep) or canonical_path(os.path.join(main_root, ".git")) != common_dir:
                            return None
                        context = context_from_directory(worktree_root, bodies, scans, False)
                        return os.path.join(main_root, os.path.basename(context["path"])) if context else None
                elif os.path.isdir(git_path):
                    return None
            except ResourceLimitError:
                raise
            except OSError:
                return None
        parent = os.path.dirname(directory)
        if parent == directory:
            return None
        directory = parent


