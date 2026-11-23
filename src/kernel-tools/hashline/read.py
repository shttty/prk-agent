from .call_file_tool import _call
from .hashline_limits import _ROWS, _BUDGET
from .references.resolve_path import _path
from .content.scan_page import _scan
from .content.read_image import _read_image
from .display.create_display_row import _row
from .display.measure_display_row import _size
from .display.assemble_result import _Result


def read(ctx, path, offset=None, limit=None):
    """Stream one page; total_lines remains None until this scan reaches EOF."""
    if offset is not None and (type(offset) is not int or offset < 1):
        raise ValueError("read offset must be a positive integer line number")
    if limit is not None and (type(limit) is not int or limit < 1):
        raise ValueError("read limit must be a positive integer")
    path, first, limit = _path(path), offset or 1, min(limit or _ROWS, _ROWS)
    image = _read_image(ctx, path)
    if image is not None:
        return image
    rows, served, size, total, following = [], {}, 0, None, None
    with open(path, "rb") as stream:
        for number, digest, text, length, eof in _scan(stream, path, first):
            if eof:
                total = number
            if number < first:
                continue
            row = _row(path, number, text, digest=digest, size=length)
            if size + _size(row) > _BUDGET:
                following = number
                break
            rows.append(row)
            served[number] = digest
            size += _size(row)
            if len(rows) == limit:
                following = None if eof else number + 1
                break
    if not rows:
        raise ValueError("read offset is beyond the last line")
    outcome = _call(ctx, "read", path=path, offset=first, limit=len(rows))
    ctx.shown.setdefault(path, {}).update(served)
    return _Result(path=path, lines=rows, total_lines=total,
                   truncated=following is not None or any(row["omitted"] for row in rows),
                   next_offset=following, tool_content=outcome.get("content", []))
