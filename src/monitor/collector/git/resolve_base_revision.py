def base_rev(root):
    ok = git(root, "rev-parse", "--verify", "-q", "HEAD", check=False).returncode == 0
    return "HEAD" if ok else EMPTY_TREE
