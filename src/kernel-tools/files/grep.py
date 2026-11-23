import contextlib
from pathlib import Path
from prk_tool import host, tool
from .file_state import _ctx
from .search.read_search_hits import hits


@tool
def grep(pattern, path=".", glob=None, ignore_case=False, literal=False, context=0, limit=100):
    """Search target files via tool_bin('rg'); returned match/context N#hhh refs are immediately editable."""
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
