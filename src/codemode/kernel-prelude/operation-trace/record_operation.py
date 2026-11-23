"""Best-effort operation trace: audit events describe attempts, not successful mutations."""
import os as _trace_os


def _trace_record(ctx, event, args):
    if not ctx.enabled or getattr(ctx.local, "busy", False) or (event != "open" and event not in ctx._operations):
        return
    cell = _current_cell()
    if (cell is None or getattr(cell, "prelude_trace", None) is not ctx
            or cell.prelude_trace_records >= ctx.options["maxRecords"]):
        return
    ctx.local.busy = True
    try:
        if event == "open" and isinstance(args[0], int):
            return  # subprocess pipes and other integer-fd opens are not file paths.
        if event in ctx._path_events:
            paths = args[:2] if event == "os.rename" else args[:1]
            for value in paths:
                if not isinstance(value, (str, bytes, _trace_os.PathLike)):
                    continue
                path = _trace_os.path.realpath(_trace_os.fsdecode(value))
                if any(path == prefix or path.startswith(prefix + _trace_os.sep) for prefix in ctx.prefixes):
                    return
        if event == "open":
            mode, flags = args[1:3]
            writing = (isinstance(mode, str) and any(char in mode for char in "wax+")) or (
                isinstance(flags, int) and flags & (
                    _trace_os.O_WRONLY | _trace_os.O_RDWR | _trace_os.O_CREAT | _trace_os.O_TRUNC | _trace_os.O_APPEND))
            operation = "write" if writing else "read"
        else:
            operation = ctx._operations[event]
        trace = {
            "event": event,
            "operation": operation,
            "args": [repr(arg)[:ctx.options["argumentChars"]] for arg in args[:ctx.options["maxArguments"]]],
            "time": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        }
        if not ctx.enabled or cell.prelude_trace is not ctx:
            return
        phase = getattr(cell, "prelude_origin", {}).get("phase")
        if phase is not None:
            trace["phase"] = phase
        cell.prelude_trace_records += 1
        _display({"application/x-prk-trace+json": trace}, raw=True)
    except Exception:
        pass  # Trace formatting/transport must not turn an observed operation into a failure.
    finally:
        ctx.local.busy = False
