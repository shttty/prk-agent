import importlib.util


def _find_spec(ctx, fullname, path=None, target=None):
    source = _specs.get(fullname)
    if source is None:
        return None
    return importlib.util.spec_from_loader(fullname, ctx, origin=source["path"], is_package=source["package"])
