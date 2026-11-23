def worktree_git(cwd, *args, env=None, output=None):
    environment = dict(os.environ)
    for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"):
        environment.pop(key, None)
    environment.update(env or {})
    result = subprocess.run(["git", "-C", cwd, *args], env=environment,
                            stdout=output if output is not None else subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise ValueError("git " + args[0] + " failed: " + result.stderr.decode("utf-8", "replace")[:4096])
    return result.stdout
