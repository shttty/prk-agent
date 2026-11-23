"""Project-owned import machinery; only executed inside the retained target kernel."""
import importlib.abc
import sys
import types


_specs = {}
_roots = {}
_errors = {}


class _SourceLoader(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    find_spec = _find_spec
    create_module = _create_module
    exec_module = _exec_module


_finder = _SourceLoader()
sys.meta_path.insert(0, _finder)
_package = types.ModuleType("prk_tools")
_package.__path__ = []
_package.__package__ = "prk_tools"
sys.modules["prk_tools"] = _package
