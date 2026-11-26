def _trace_cell(ctx):
    """The current cell while it owns this trace and has record budget left, else None."""
    cell = _current_cell()
    if (ctx.enabled and cell is not None and getattr(cell, "prelude_trace", None) is ctx
            and cell.prelude_trace_records < ctx.options["maxRecords"]):
        return cell
    return None
