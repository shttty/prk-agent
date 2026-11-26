from typing import Optional as _Optional


def phase(title: _Optional[str]) -> None:
    """Label the current cell's next phase in the UI; does not call the Gateway. phase(None) clears the label."""
    cell = _current_cell()
    if cell is None:
        return
    if not hasattr(cell, "prelude_origin"):
        begin_cell("Python cell")
    if title is None:
        cell.prelude_origin.pop("phase", None)
    else:
        cell.prelude_origin["phase"] = title
    _display({"application/x-prk-phase+json": {"title": title, "time": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime())}}, raw=True)


