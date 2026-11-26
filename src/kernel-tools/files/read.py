from typing import Optional
from prk_tool import host, tool
from .file_state import _ctx
from .file_types import ReadResult


@tool
def read(path: str, offset: Optional[int] = None, limit: Optional[int] = None) -> ReadResult:
    """View a text file as N#hhh line refs (up to 2000 lines / 50KB per page) or attach an image. Use instead of open()/cat.

    Streams UTF-8 pages; offset is a 1-based line number, and next_offset continues after a
    truncated page. total_lines stays None until a scan reaches the end of the file. print(view)
    shows N#hhh│content, with refs salted by the file's realpath. A line too long to show has
    text None but its ref still edits the whole line. Images (PNG/JPEG/GIF/WebP/BMP, up to
    20MB) are attached to the cell output. Path/open is for processing data, not for viewing.
    """
    host.trace("read", path)
    return _ctx._session.read(path, offset=offset, limit=limit)
