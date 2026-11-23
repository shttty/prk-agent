"""The only PRK host coupling available to injected tool modules."""
import sys
from functools import partial
from types import SimpleNamespace


_host = None
_overrides = {}
_configs = {}


host = SimpleNamespace(
    tool_bin=partial(_tool_bin, sys.modules[__name__]),
    call=partial(_call, sys.modules[__name__]),
    file_call=_file_call,
    trace=partial(_trace, sys.modules[__name__]),
    progress=partial(_progress, sys.modules[__name__]),
)
