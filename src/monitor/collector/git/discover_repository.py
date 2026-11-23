def discover(directory):
    """`git rev-parse --show-toplevel`: git's own repository discovery (GIT_DIR, ceilings, safe.directory, worktrees)."""
    try:
        out = git(resolve(directory), "rev-parse", "--show-toplevel", check=False)
        top = out.stdout.decode("utf-8", "replace").strip()
        if out.returncode == 0 and top:
            found = ("root", top)
        else:
            lines = out.stderr.decode("utf-8", "replace").strip().splitlines()
            reason = (lines[0] if lines else "git failed")[:200]
            # "unavailable" = git could not even decide (dubious ownership, broken .git, ...), as opposed to a plain "no repository here"
            found = ("none", reason, "not a git repository" not in reason)
    except (OSError, subprocess.SubprocessError) as error:
        found = ("none", (str(error).splitlines() or ["git not available"])[0][:200], True)
    return found
