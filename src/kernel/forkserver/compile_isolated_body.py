import ast
import inspect
import types


_ISOLATED_FILENAME = "<isolated cell>"


def compile_isolated_body(source):
    tree = ast.parse(source, _ISOLATED_FILENAME)
    body = tree.body
    # A function docstring stays in the function. Leading futures must stay at module
    # level for the compiler; their imported bindings become locals of the function.
    offset = int(bool(body and isinstance(body[0], ast.Expr)
                      and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str)))
    end = offset
    while end < len(body) and isinstance(body[end], ast.ImportFrom) and body[end].module == "__future__" and body[end].level == 0:
        end += 1
    futures = body[offset:end]
    del body[offset:end]
    aliases = list(dict.fromkeys(alias.asname or alias.name for node in futures for alias in node.names))
    name = "_prk_isolated_body"
    while name in aliases:
        name += "_"
    arguments = ast.arguments(posonlyargs=[], args=[ast.arg(arg=key) for key in aliases],
                              kwonlyargs=[], kw_defaults=[], defaults=[])
    # Parse a scaffold to get the interpreter's full AST shape (including newer fields).
    function = ast.parse("async def _prk_isolated_body(): pass").body[0]
    function.name, function.args, function.body = name, arguments, body or [ast.Pass()]
    if body:
        ast.copy_location(function, body[0])
    tree.body = futures + [function]
    code = compile(ast.fix_missing_locations(tree), _ISOLATED_FILENAME, "exec", dont_inherit=True)
    function_code = next(part for part in code.co_consts if isinstance(part, types.CodeType))
    if function_code.co_flags & inspect.CO_ASYNC_GENERATOR:
        raise SyntaxError("Isolated cell body must return a value, not yield values")
    return code, name, aliases
