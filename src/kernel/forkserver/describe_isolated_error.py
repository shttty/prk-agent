from collections import deque


def describe_isolated_error(error, limit):
    name = isolated_type_name(error)[:64]
    locations = deque(maxlen=8)
    trace = BaseException.__traceback__.__get__(error)
    while trace is not None:
        code = trace.tb_frame.f_code
        if code.co_filename == _ISOLATED_FILENAME:
            locations.append(f'  File "{code.co_filename}", line {trace.tb_lineno}, in {code.co_name[:64]}\n')
        trace = trace.tb_next
    try:
        if (isinstance(error, SyntaxError) and error.filename == _ISOLATED_FILENAME
                and type(error.lineno) is int and type(error.msg) is str):
            return name, (f'File "{_ISOLATED_FILENAME}", line {error.lineno}\n' + error.msg[:limit])[:limit]
        detail = str(error)[:limit]
    except BaseException:
        detail = "<exception message unavailable>"
    return name, ("".join(locations) + detail)[:limit]
