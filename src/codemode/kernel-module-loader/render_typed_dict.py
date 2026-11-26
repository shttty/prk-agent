import typing


def _render_typed_dict(typed_dict):
    """A TypedDict class as stub text; an Annotated string on a field becomes its comment."""
    lines = ["class " + typed_dict.__name__ + "(TypedDict):"]
    for field, hint in typing.get_type_hints(typed_dict, include_extras=True).items():
        rendered = _render_annotation(hint)
        if field in typed_dict.__optional_keys__:
            rendered = "NotRequired[" + rendered + "]"
        notes = [note for note in getattr(hint, "__metadata__", ()) if isinstance(note, str)]
        lines.append("    " + field + ": " + rendered + ("  # " + "; ".join(notes) if notes else ""))
    return "\n".join(lines if len(lines) > 1 else [*lines, "    ..."])
