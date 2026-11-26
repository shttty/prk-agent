import inspect
import typing

_STUB_WIDTH = 100


def _describe_function(name, function, known_types):
    """What the model sees of a tool: signature, first docstring paragraph, and a typed stub.

    Annotations come from the function itself; a missing one renders as Any rather than a guess.
    known_types maps TypedDict names to classes across every function, so two different classes
    sharing a name are rejected instead of silently merged.
    """
    hints = typing.get_type_hints(function, include_extras=True)
    signature = inspect.signature(function)
    parameters = _render_parameters(signature, hints)
    returns = _render_annotation(hints.get("return", typing.Any))
    summary = " ".join((inspect.getdoc(function) or "").split("\n\n")[0].split())
    found = {}
    for annotation in hints.values():
        _collect_typed_dicts(annotation, found)
    for type_name, typed_dict in found.items():
        if known_types.setdefault(type_name, typed_dict) is not typed_dict:
            raise ValueError("Two different TypedDicts are named " + type_name)
    line = "def " + name + "(" + ", ".join(parameters) + ") -> " + returns + ":"
    if len(line) > _STUB_WIDTH:
        line = "def " + name + "(\n" + "".join("    " + parameter + ",\n" for parameter in parameters) + ") -> " + returns + ":"
    body = '\n    """' + summary.replace('"""', "'''") + '"""' if summary else " ..."
    return {"signature": "(" + ", ".join(parameters) + ") -> " + returns, "description": summary,
            "stub": line + body, "types": {key: _render_typed_dict(found[key]) for key in sorted(found)}}


def _render_parameters(signature, hints):
    rendered = []
    parameters = list(signature.parameters.values())
    has_variadic = any(parameter.kind is parameter.VAR_POSITIONAL for parameter in parameters)
    for index, parameter in enumerate(parameters):
        if parameter.kind is parameter.KEYWORD_ONLY and not has_variadic and (index == 0 or parameters[index - 1].kind is not parameter.KEYWORD_ONLY):
            rendered.append("*")
        prefix = {parameter.VAR_POSITIONAL: "*", parameter.VAR_KEYWORD: "**"}.get(parameter.kind, "")
        text = prefix + parameter.name + ": " + _render_annotation(hints.get(parameter.name, typing.Any))
        if parameter.default is not parameter.empty:
            text += " = " + (repr(parameter.default) if parameter.default is None or isinstance(parameter.default, (bool, int, float, str, bytes)) else "...")
        rendered.append(text)
        if parameter.kind is parameter.POSITIONAL_ONLY and (index + 1 == len(parameters) or parameters[index + 1].kind is not parameter.POSITIONAL_ONLY):
            rendered.append("/")
    return rendered
