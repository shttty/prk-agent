def handle_worktree(command):
    op = command.get("op")
    fields = {
        "create": {"cwd", "sessionId"},
        "patch": {"repoRoot", "worktreeRoot", "baseCommit", "parentState", "path"},
        "readPatch": {"path", "offset"},
        "remove": {"repoRoot", "worktreeRoot"},
    }
    if op not in fields or set(command) != {"id", "mod", "op"} | fields[op]:
        raise ValueError("Invalid worktree request fields or operation")
    for key in fields[op] - {"offset"}:
        value = command[key]
        if not isinstance(value, str) or not value or "\0" in value or len(value) > 4096:
            raise ValueError("Invalid worktree field: " + key)
        if key in ("cwd", "repoRoot", "worktreeRoot", "path") and not os.path.isabs(value):
            raise ValueError(key + " must be absolute")
    if op == "create":
        if not re.fullmatch(r"[a-zA-Z0-9-]{1,128}", command["sessionId"]):
            raise ValueError("Invalid sessionId")
        return create_worktree(command)
    if op == "patch":
        if not re.fullmatch(r"[0-9a-f]{40,64}", command["baseCommit"]):
            raise ValueError("Invalid baseCommit")
        return create_worktree_patch(command)
    if op == "remove":
        worktree_git(command["repoRoot"], "worktree", "remove", "--force", command["worktreeRoot"])
        return {}
    offset = command["offset"]
    if type(offset) is not int or not 0 <= offset <= PATCH_MAX_BYTES:
        raise ValueError("Invalid patch offset")
    with open(command["path"], "rb") as source:
        source.seek(offset)
        return {"data": base64.b64encode(source.read(PATCH_CHUNK_BYTES)).decode("ascii")}
