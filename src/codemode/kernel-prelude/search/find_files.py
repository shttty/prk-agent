from typing import TypedDict as _TypedDict


class GlobResult(_TypedDict):
    """Typed shape of the mapping glob returns (the runtime class is _GlobResult)."""
    files: list[str]
    truncated: bool
    limit_reached: bool
    output_limited: bool


def glob(pattern: str, path: str = ".", hidden: bool = False, gitignore: bool = True, limit: int = 100) -> GlobResult:
    """List files under path matching an rg glob, sorted, at most 1000 files / 50KB, e.g. glob('src/**/*.py').

    rg globs: *.py matches basenames at any depth; src/*.py matches directly in src;
    src/**/*.py includes src and all descendants (** spans zero or more dirs).
    Hidden paths are excluded unless hidden=True; gitignore=False passes --no-ignore.
    .git directories are always excluded; directory symlinks are not followed.
    Reads one extra file to detect true truncation, so limit_reached is exact. Missing
    path/rg or an invalid glob raises; no matches is files=[]. print(result) shows the paths.
    """
    if type(limit) is not int or limit < 1:
        raise ValueError("glob limit must be a positive integer")
    limit = min(limit, 1000)
    path = _Path(path).resolve(strict=True)
    if not path.is_dir():
        raise NotADirectoryError(str(path))
    command = [_helper_functions["tool_bin"]("rg"), "--no-config", "--files", "--null", "--sort=path"]
    if hidden:
        command.append("--hidden")
    if not gitignore:
        command.append("--no-ignore")
    exclusions = ["--glob", "!.git"]
    if not hidden:
        exclusions.extend(["--glob", "!.*"])
    result = _GlobResult(files=[], truncated=False, limit_reached=False, output_limited=False)
    size = 0
    with _glob_contextlib.ExitStack() as stack:
        matches = stack.enter_context(_glob_scan([*command, "--glob", pattern, *exclusions, "--", "."], path))
        # rg positive --glob overrides ignore files. Intersect with its unfiltered
        # file stream instead of reimplementing .gitignore/.ignore in Python.
        allowed = stack.enter_context(_glob_scan([*command, *exclusions, "--", "."], path)) if gitignore else None
        current = next(allowed, None) if allowed is not None else None
        for raw in matches:
            if allowed is not None:
                # rg --sort=path sorts each directory during traversal, not raw
                # full-path bytes: a/b precedes a+, so compare path components.
                key = raw.split(b"/")
                while current is not None and current.split(b"/") < key:
                    current = next(allowed, None)
                if current is None:
                    break
                if current != raw:
                    continue
            if len(result["files"]) == limit:
                result["limit_reached"] = result["truncated"] = True
                break
            name = _Path(_os.fsdecode(raw)).as_posix()
            row_size = len((repr(name) + "\n").encode("utf-8"))
            if size + row_size > 50 * 1024 - 256:
                result["output_limited"] = result["truncated"] = True
                break
            result["files"].append(name)
            size += row_size
    return result


