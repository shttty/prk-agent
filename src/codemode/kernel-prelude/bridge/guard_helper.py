from functools import wraps as _helper_wraps


def _guard_helper(name, function):
    @_helper_wraps(function)
    def invoke(*args, **kwargs):
        _require_capability(name)
        return function(*args, **kwargs)
    return invoke
