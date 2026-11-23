from prk_tool import tool, config, host
from prk_tools.public_value import value
DEFAULT_CONFIG = {"delta": 1, "nested": {"items": [1, 2]}}
options = config(__name__)
calls = 0
@tool
def automatic_probe(extra: int = 0) -> int:
    """AUTOMATIC_MODULE_DESCRIPTION_7013
    This second docstring line is not catalog metadata.
    """
    global calls
    calls += 1
    assert options["nested"]["items"] == (1, 2)
    try:
        options["nested"]["items"] = ()
    except TypeError:
        pass
    else:
        raise AssertionError("config is mutable")
    host.trace("read", "module-probe")
    host.progress("stdout", "UI_ONLY_MODULE_PROGRESS_7013")
    return value() + options["delta"] + extra
_automatic_alias = automatic_probe

def call_peers():
    return host.call("session_list")
