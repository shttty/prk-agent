import json
import linecache
import sys


def _exec_module(ctx, module):
    root = module.__name__.split(".")[1]
    entry = _roots[root]
    if entry.get("error"):
        raise ImportError(entry["error"])
    if root in _errors:
        raise ImportError(_errors[root])
    dependencies = entry["dependencies"]
    if dependencies.get("python"):
        raise ImportError("Python wheel distribution is not implemented; declared dependencies are unavailable: " + json.dumps(dependencies["python"]))
    if module.__name__ == "prk_tools." + root:
        for binary in dependencies.get("binaries", []):
            sys.modules["prk_tool"].host.tool_bin(binary)
    source = _specs[module.__name__]
    module.__file__ = source["path"]
    if source["package"]:
        module.__path__ = [source["path"].rsplit("/", 1)[0]]
    linecache.cache[source["path"]] = (len(source["source"]), None, source["source"].splitlines(True), source["path"])
    exec(compile(source["source"], source["path"], "exec", dont_inherit=True), module.__dict__)
    if module.__name__ == "prk_tools." + root:
        sys.modules["prk_tool"].config(module.__name__)
