from ..hashline_limits import _BUDGET
from ..content.strip_line_ending import _logical
from ..references.hash_line import _hash
from .create_display_row import _row
from .measure_display_row import _size
from .assemble_result import _Result


def _context(ctx, path, lines, number):
    start = max(1, min(number, len(lines)) - 2)
    rows, size, served = [], 0, {}
    for current in range(start, min(len(lines) + 1, start + 5)):
        text = _logical(lines[current - 1])
        digest = _hash(path, text)
        row = _row(path, current, text, digest=digest)
        if size + _size(row) > _BUDGET:
            break
        rows.append(row)
        served[current] = digest
        size += _size(row)
    ctx.shown.setdefault(path, {}).update(served)
    following = start + len(rows)
    return _Result(path=path, lines=rows, total_lines=len(lines),
                   truncated=following <= len(lines) or any(row["omitted"] for row in rows),
                   next_offset=following if following <= len(lines) else None)
