import inspect
from functools import wraps


def tool(function):
    """Explicitly expose a synchronous public Python function to the model."""
    if (not inspect.isfunction(function) or inspect.iscoroutinefunction(function)
            or inspect.isasyncgenfunction(function) or function.__name__.startswith("_")):
        raise TypeError("@prk_tool.tool requires a public synchronous Python function")
    @wraps(function)
    def invoke(*args, **kwargs):
        _host._require_capability(function.__name__)
        return function(*args, **kwargs)
    invoke.__prk_tool__ = True
    return invoke


