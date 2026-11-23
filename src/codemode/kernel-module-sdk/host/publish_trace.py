def _trace(ctx, operation, *args):
    """Publish an explicit operation trace, subject to the existing trace budget."""
    trace = ctx._host._trace
    if not trace.enabled or not trace.active or trace.records >= trace.options["maxRecords"]:
        return
    trace.records += 1
    value = {"event": "prk.tool", "operation": operation,
             "args": [repr(arg)[:trace.options["argumentChars"]] for arg in args[:trace.options["maxArguments"]]],
             "time": ctx._host._time.strftime("%Y-%m-%dT%H:%M:%SZ", ctx._host._time.gmtime())}
    if ctx._host._cell_phase is not None:
        value["phase"] = ctx._host._cell_phase
    ctx._host._display({"application/x-prk-trace+json": value}, raw=True)
