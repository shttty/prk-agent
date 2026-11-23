import __future__
import ast
import inspect


_ALLOW_AWAIT = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
_FUTURE_FLAGS = sum(getattr(__future__, name).compiler_flag for name in __future__.all_feature_names)


class _ModuleReturnProbe(ast.NodeTransformer):
    changed = False

    def visit_Return(self, node):
        self.changed = True
        value = node.value if node.value is not None else ast.Constant(None)
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            # A returned string is not a docstring and must not legalize a later future import.
            value = ast.Tuple(elts=[value], ctx=ast.Load())
        return ast.fix_missing_locations(ast.copy_location(ast.Expr(value=value), node))

    def visit_FunctionDef(self, node):
        return node

    visit_AsyncFunctionDef = visit_ClassDef = visit_FunctionDef


def compile_cell(source, filename, explicit_mode, default_mode):
    """Return (mode, body code, tail code). Isolated routing never produces runnable code."""
    tree = None
    probe = source
    if explicit_mode == "isolated" or (explicit_mode is None and default_mode == "isolated"):
        tree = compile(source, filename, "exec", flags=_ALLOW_AWAIT | ast.PyCF_ONLY_AST, dont_inherit=True)
        if explicit_mode == "isolated":
            return "isolated", None, None
        mapper = _ModuleReturnProbe()
        mapper.visit(tree)
        if mapper.changed:
            probe = tree

    whole = compile(probe, filename, "exec", flags=_ALLOW_AWAIT, dont_inherit=True)
    mode = explicit_mode or ("async" if whole.co_flags & inspect.CO_COROUTINE else default_mode)
    if mode == "isolated":
        return mode, None, None
    if probe is not source:
        # The altered tree only decides routing. Shared modes must validate the original module.
        whole = compile(source, filename, "exec", flags=_ALLOW_AWAIT, dont_inherit=True)
        tree = None

    if tree is None:
        tree = compile(source, filename, "exec", flags=_ALLOW_AWAIT | ast.PyCF_ONLY_AST, dont_inherit=True)
    if not tree.body or not isinstance(tree.body[-1], ast.Expr):
        return mode, whole, None

    tail = ast.Expression(tree.body.pop().value)
    body_code = compile(tree, filename, "exec", flags=_ALLOW_AWAIT, dont_inherit=True)
    tail_code = compile(tail, filename, "eval", flags=_ALLOW_AWAIT | (whole.co_flags & _FUTURE_FLAGS),
                        dont_inherit=True)
    return mode, body_code, tail_code
