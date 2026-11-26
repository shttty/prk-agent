def _trace_publish(ctx, event, operation, args):
    """Display one record for the cell that owns this trace, within that cell's record budget."""
    trace = {
        "event": event,
        "operation": operation,
        "args": [repr(arg)[:ctx.options["argumentChars"]] for arg in args[:ctx.options["maxArguments"]]],
        "time": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
    }
    cell = _trace_cell(ctx)
    if cell is None:
        return
    phase = getattr(cell, "prelude_origin", {}).get("phase")
    if phase is not None:
        trace["phase"] = phase
    cell.prelude_trace_records += 1
    _display({"application/x-prk-trace+json": trace}, raw=True)
