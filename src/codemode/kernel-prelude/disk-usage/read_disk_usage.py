from typing import TypedDict as _TypedDict


class DiskUsage(_TypedDict):
    path: str
    bytes: int
    children: list["DiskUsage"]


def disk_usage(path: str = ".", depth: int = 1, limit: int = 50, apparent: bool = False) -> DiskUsage:
    """Directory sizes via dust: the tree under path down to depth, largest first.

    limit caps the entries listed per level (dust --number-of-lines); apparent=True counts file
    length instead of allocated blocks.
    """
    command = [_helper_functions["tool_bin"]("dust"), "--output-json", "--output-format", "b", "--no-progress", "--depth", str(depth), "--number-of-lines", str(limit)]
    result = _subprocess.run([*command, *(["--apparent-size"] if apparent else []), "--", path], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"dust exited {result.returncode}: {result.stderr.strip()}")

    def convert(node):
        return {"path": node["name"], "bytes": int(node["size"].removesuffix("B")), "children": [convert(child) for child in node["children"]]}
    return convert(_json.loads(result.stdout))


