

def __init__(ctx, *, execute, align_window=2000, max_edit_bytes=200 * 1024 * 1024):
    for name, value in (("align_window", align_window), ("max_edit_bytes", max_edit_bytes)):
        if type(value) is not int or value < 1:
            raise ValueError(f"{name} must be a positive integer")
    ctx.align_window = align_window
    ctx.max_edit_bytes = max_edit_bytes
    if not callable(execute):
        raise TypeError("execute must call the owning native file tool")
    ctx.execute = execute
    ctx.shown = {}
