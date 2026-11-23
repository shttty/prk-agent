from ..hashline_limits import _ROWS, _BUDGET
from ..content.strip_line_ending import _logical
from ..references.hash_line import _hash
from .create_display_row import _row
from .measure_display_row import _size


def append(ctx, kind, index, source, row_limit=_ROWS, byte_limit=_BUDGET):
    text = _logical(source[index])
    digest = _hash(ctx.path, text)
    row = _row(ctx.path, index + 1, text, digest=digest, kind=kind)
    if len(ctx.rows) >= row_limit or ctx.size + _size(row) > byte_limit:
        ctx.truncated = True
        return False
    ctx.rows.append(row)
    ctx.size += _size(row)
    if kind != "-":
        ctx.session.shown[ctx.path][index + 1] = digest
    return True
