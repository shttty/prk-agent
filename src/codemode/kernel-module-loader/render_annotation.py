import types
import typing

_UNIONS = (typing.Union, getattr(types, "UnionType", typing.Union))


def _render_annotation(annotation):
    """Type annotation as stub text; the same annotation always renders the same bytes."""
    if annotation is typing.Any:
        return "Any"
    if annotation is None or annotation is type(None):
        return "None"
    if annotation is Ellipsis:
        return "..."
    if isinstance(annotation, list):
        return "[" + ", ".join(_render_annotation(item) for item in annotation) + "]"
    origin = typing.get_origin(annotation)
    arguments = typing.get_args(annotation)
    if origin is typing.Annotated:
        return _render_annotation(arguments[0])
    if origin in _UNIONS:
        return " | ".join(_render_annotation(item) for item in arguments)
    if origin is typing.Literal:
        return "Literal[" + ", ".join(repr(item) for item in arguments) + "]"
    if origin is not None:
        return origin.__name__ + "[" + ", ".join(_render_annotation(item) for item in arguments) + "]"
    return getattr(annotation, "__name__", None) or str(annotation).replace("typing.", "")
