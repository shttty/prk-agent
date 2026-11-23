def begin_cell(title):
    cell = _current_cell()
    if cell is not None:
        cell.prelude_origin = {"title": title, "time": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime())}


