from prk_tool import host, tool
from .file_state import _ctx


@tool
def write(path, content):
    """Execute native write with plugin hooks; clear displayed refs; native tool creates parents."""
    host.trace("write", path)
    return _ctx._session.write(path, content)
