from .replacements.apply_edit import _edit
from .hashline_limits import _REF
from .references.resolve_path import _path
from .content.validate_text import _text


def edit(ctx, path, operations):
    """Validate displayed refs, call native edit, and refresh from post-hook disk bytes."""
    if not isinstance(operations, list) or not operations:
        raise ValueError("edit requires a nonempty list of operations")
    parsed = []
    for operation in operations:
        if not isinstance(operation, dict):
            raise ValueError("edit operations must be dictionaries")
        kind = operation.get("op")
        keys = {"op", "start", "end", "text"} if kind == "replace" else {"op", "ref", "where", "text"}
        if kind not in ("replace", "insert") or operation.keys() != keys:
            raise ValueError("replace requires op/start/end/text; insert requires op/ref/where/text")
        _text(operation["text"])
        if kind == "insert" and operation["where"] not in ("before", "after"):
            raise ValueError("insert where must be before or after")
        refs = []
        for key in (("start", "end") if kind == "replace" else ("ref",)):
            match = _REF.fullmatch(operation[key]) if isinstance(operation[key], str) else None
            if match is None:
                raise ValueError("edit references must have the form N#hhh")
            refs.append((int(match[1]), int(match[2], 16)))
        if kind == "replace" and refs[1][0] < refs[0][0]:
            raise ValueError("replace range is reversed")
        parsed.append((operation, refs))
    path = _path(path)
    return _edit(ctx, path, parsed)
