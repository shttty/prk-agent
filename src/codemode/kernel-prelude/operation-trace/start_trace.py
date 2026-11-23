def _trace_start(ctx, *_):
    cell = _current_cell()
    if cell is not None:
        cell.prelude_trace = ctx
        cell.prelude_trace_records = 0
