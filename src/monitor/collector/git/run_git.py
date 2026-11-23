def git(root, *args, check=True):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS="0", LC_ALL="C")
    out = subprocess.run(
        ["git", "-c", "core.quotepath=off", "-C", root] + list(args),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=GIT_TIMEOUT_S,
    )
    if check and out.returncode != 0:
        raise RuntimeError(out.stderr.decode("utf-8", "replace").strip() or "git failed")
    return out
