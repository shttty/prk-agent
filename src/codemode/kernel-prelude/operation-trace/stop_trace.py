def _trace_stop(ctx, *_):
    cell = _current_cell()
    if cell is not None and getattr(cell, "prelude_trace", None) is ctx:
        cell.prelude_trace = None
