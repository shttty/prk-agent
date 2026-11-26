from typing import Annotated as _Annotated, Optional as _Optional, TypedDict as _TypedDict


class LsResult(_TypedDict):
    """Typed shape of the mapping ls returns (the runtime class is _LsResult)."""
    entries: _Annotated[list[str], "names in case-sensitive order; directories end in '/'"]
    total: int
    truncated: bool
    next_offset: _Annotated[_Optional[int], "pass as offset to continue; None at the end"]


def ls(path: str = ".", offset: int = 1, limit: int = 500) -> LsResult:
    """List a directory's direct children, hidden names included and directories ending in '/'; page with next_offset.

    At most 2000 entries / 50KB per page; offset is 1-based and limit positive. print(result)
    shows one quoted name per line plus a continuation hint. Continue with
    ls(path, offset=result['next_offset']) on the same path until next_offset is None; each
    call rescans the directory, so keep it unchanged while paging. Offsets beyond total raise
    (an empty directory accepts offset=1), as do missing or non-directory paths.
    """
    if type(offset) is not int or offset < 1:
        raise ValueError("ls offset must be a positive 1-based integer")
    if type(limit) is not int or limit < 1:
        raise ValueError("ls limit must be a positive integer")
    limit = min(limit, 2000)
    with _os.scandir(path) as scan:
        entries = sorted(scan, key=lambda entry: entry.name)
    total = len(entries)
    if offset > max(1, total):
        raise ValueError(f"ls offset {offset} exceeds total entries {total}")
    names = []
    size = 0
    for entry in entries[offset - 1:offset - 1 + limit]:
        name = entry.name + ("/" if entry.is_dir() else "")
        row_size = len((repr(name) + "\n").encode("utf-8"))
        if size + row_size > 50 * 1024 - 256:
            break
        names.append(name)
        size += row_size
    end = offset - 1 + len(names)
    return _LsResult(entries=names, total=total, truncated=end < total,
                     next_offset=end + 1 if end < total else None)


