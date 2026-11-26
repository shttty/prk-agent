import typing


def _is_typed_dict(annotation):
    return isinstance(annotation, type) and issubclass(annotation, dict) and hasattr(annotation, "__required_keys__")


def _collect_typed_dicts(annotation, found):
    """Add every TypedDict reachable from the annotation to found, keyed by class name."""
    if _is_typed_dict(annotation):
        if found.get(annotation.__name__) is annotation:
            return
        if annotation.__name__ in found:
            raise ValueError("Two different TypedDicts are named " + annotation.__name__)
        found[annotation.__name__] = annotation
        for field in typing.get_type_hints(annotation, include_extras=True).values():
            _collect_typed_dicts(field, found)
        return
    for item in annotation if isinstance(annotation, list) else typing.get_args(annotation):
        _collect_typed_dicts(item, found)
