import contextlib
from pathlib import Path
from typing import Optional
from prk_tool import host, tool
from .file_state import _ctx
from .file_types import GrepResult
from .search.read_search_hits import hits


@tool
def grep(pattern: str, path: str = ".", glob: Optional[str] = None, ignore_case: bool = False, literal: bool = False,
         context: int = 0, limit: int = 100) -> GrepResult:
    """Search files with ripgrep; match and context refs can go straight to edit(). Use instead of shelling out to grep/rg.

    Uses tool_bin('rg') and its regex and ignore rules; context is at most 10 lines, hits at
    most 1000, output at most 50KB. Pass literal=True for a fixed string and glob to
    restrict file names. Rows with match=True are the hits and the rest are context. print(result)
    shows the refs. An empty files list is a normal no-match result; search errors raise.
    """
    if type(context) is not int or context < 0:
        raise ValueError("grep context must be a nonnegative integer")
    if type(limit) is not int or limit < 1:
        raise ValueError("grep limit must be a positive integer")
    context, limit = min(context, 10), min(limit, 1000)
    path = Path(path).resolve(strict=True)
    command = [host.tool_bin("rg"), "--no-config", "--json", "--threads=1",
               "--line-number", "--color=never", "--encoding=utf-8", "--crlf",
               "--context", str(context)]
    if ignore_case:
        command.append("--ignore-case")
    if literal:
        command.append("--fixed-strings")
    if glob is not None:
        command.extend(["--glob", glob])
    command.extend(["--", pattern, str(path)])
    host.trace("read", path)
    state = {"matches": 0, "limit_reached": False, "stopped": False}


    with contextlib.closing(hits(command, state, context, limit)) as rows:
        result = _ctx._session.grep(rows)
    result["limit_reached"] = state["limit_reached"]
    result["truncated"] = result["truncated"] or result["limit_reached"]
    return result
