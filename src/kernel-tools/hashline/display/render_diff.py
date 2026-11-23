from .assemble_diff import assemble_diff
from ..hashline_limits import _ROWS, _BUDGET
from .append_diff_row import append
from .assemble_result import _Result


def _diff(ctx, path, before, after, changes):
    display = assemble_diff(ctx, path)
    context_end = 0


    for position, (start, end, new_start, new_end) in enumerate(changes):
        for index in range(max(context_end, new_start - 2), new_start):
            if not append(display, " ", index, after):
                break
        row_limit = len(display.rows) + (_ROWS - len(display.rows)) // 2 if new_end > new_start else _ROWS
        byte_limit = display.size + (_BUDGET - display.size) // 2 if new_end > new_start else _BUDGET
        for index in range(start, end):
            if not append(display, "-", index, before, row_limit, byte_limit):
                break
        for index in range(new_start, new_end):
            if not append(display, "+", index, after):
                break
        next_start = changes[position + 1][2] if position + 1 < len(changes) else len(after)
        context_end = min(len(after), new_end + 2, next_start)
        for index in range(new_end, context_end):
            if not append(display, " ", index, after):
                break
    return _Result(path=path, diff=display.rows, truncated=display.truncated or any(row["omitted"] for row in display.rows))
