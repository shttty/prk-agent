from prk_tool import host, tool
from .file_state import _ctx
from .file_types import WriteResult


@tool
def write(path: str, content: str) -> WriteResult:
    """Create or overwrite a whole file, creating parent directories. For targeted changes use read() then edit().

    Runs the native write with plugin hooks and clears the file's displayed refs, so read it
    again before editing. When a target-side formatter changed the written bytes, formatted is
    True and lines holds the file as it is now.
    """
    host.trace("write", path)
    return _ctx._session.write(path, content)
