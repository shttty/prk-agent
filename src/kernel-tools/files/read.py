from prk_tool import host, tool
from .file_state import _ctx


@tool
def read(path, offset=None, limit=None):
    """Read streaming UTF-8 pages as N#hhh refs (max 2000 rows/50KB), or attach an image (PNG/JPEG/GIF/WebP/BMP, max 20MB)."""
    host.trace("read", path)
    return _ctx._session.read(path, offset=offset, limit=limit)
