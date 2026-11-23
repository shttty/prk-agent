from prk_tool import host, tool
from .file_state import _ctx


@tool
def edit(path, operations):
    """Validate displayed N#hhh ranges, execute native edit with plugin hooks, return actual live-ref diff."""
    host.trace("write", path)
    return _ctx._session.edit(path, operations)
