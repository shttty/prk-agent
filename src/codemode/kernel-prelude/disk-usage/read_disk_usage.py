def disk_usage(path=".", depth=1, limit=50, apparent=False):
    """dust on this target: {path, bytes, children:[...]} largest first down to `depth`; `limit` caps listed entries; apparent=True counts file length instead of blocks."""
    command = [_helper_functions["tool_bin"]("dust"), "--output-json", "--output-format", "b", "--no-progress", "--depth", str(depth), "--number-of-lines", str(limit)]
    result = _subprocess.run([*command, *(["--apparent-size"] if apparent else []), "--", path], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"dust exited {result.returncode}: {result.stderr.strip()}")

    def convert(node):
        return {"path": node["name"], "bytes": int(node["size"].removesuffix("B")), "children": [convert(child) for child in node["children"]]}
    return convert(_json.loads(result.stdout))


