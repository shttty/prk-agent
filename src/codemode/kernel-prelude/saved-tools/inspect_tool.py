import ast as _library_ast
import __future__ as _library_future
import inspect as _library_inspect
import textwrap as _library_textwrap
import types as _library_types


def _library_metadata(function):
    if not _library_inspect.isfunction(function) or _library_inspect.iscoroutinefunction(function):
        raise TypeError("Persisted tools must be synchronous Python functions")
    if function.__closure__:
        raise ValueError("Persisted tools cannot capture a closure; pass values as arguments")
    if function.__name__ in _helper_functions:
        raise ValueError("Persisted tool name conflicts with a project prelude helper: " + function.__name__)
    source = _library_textwrap.dedent(_library_inspect.getsource(function))
    tree = _library_ast.parse(source)
    node = next(item for item in tree.body if isinstance(item, _library_ast.FunctionDef))
    node.decorator_list = []
    imports = []
    if function.__code__.co_flags & _library_future.annotations.compiler_flag:
        imports.append("from __future__ import annotations")
    # inspect resolves the actual function globals, rather than guessing dependencies from text.
    dependencies = dict(_library_inspect.getclosurevars(function).globals)
    signature_nodes = list(node.args.defaults) + [item for item in node.args.kw_defaults if item is not None]
    signature_nodes += [item.annotation for item in node.args.posonlyargs + node.args.args + node.args.kwonlyargs if item.annotation]
    signature_nodes += [item for item in [node.returns, getattr(node.args.vararg, "annotation", None), getattr(node.args.kwarg, "annotation", None)] if item is not None]
    for expression in signature_nodes:
        for item in _library_ast.walk(expression):
            if isinstance(item, _library_ast.Name) and item.id in function.__globals__:
                dependencies[item.id] = function.__globals__[item.id]
    for name, value in dependencies.items():
        if name == function.__name__ or name in _exports:
            continue
        if isinstance(value, _library_types.ModuleType) and value.__name__ != "__main__":
            statement = "import " + value.__name__ + " as " + name
        elif getattr(value, "__module__", None) not in (None, "__main__") and getattr(value, "__name__", None):
            statement = "from " + value.__module__ + " import " + value.__name__ + " as " + name
        else:
            raise ValueError("Persisted tool depends on non-import global " + name + "; pass it as an argument or define it inside the function")
        imports.append(statement)
    # Function-local imports are dependencies too. Preserve them in source, test availability on load.
    for item in _library_ast.walk(node):
        if isinstance(item, (_library_ast.Import, _library_ast.ImportFrom)):
            statement = _library_ast.unparse(item)
            if statement not in imports:
                imports.append(statement)
    return {"name": function.__name__, "source": _library_ast.unparse(node),
            "signature": str(_library_inspect.signature(function)),
            "docstring": _library_inspect.getdoc(function) or "", "imports": imports}


