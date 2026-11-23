class _Result(dict):
    from .render_result import __str__
    __repr__ = __str__
    from .display_result import _repr_pretty_
