__doc__ = "PRK-owned target helpers. Not a sandbox or a security audit."
import json as _json
import re as _re
import os as _os
import sys as _sys
import threading as _threading
import time as _time
from pathlib import Path as _Path
from contextvars import Context as _Context
from types import MethodType as _MethodType, SimpleNamespace as _SimpleNamespace


class _LsResult(dict):
    __str__ = _directory_result_string
    __repr__ = __str__
    _repr_pretty_ = _directory_result_pretty


class _GlobResult(dict):
    __str__ = _glob_result_string
    __repr__ = __str__
    _repr_pretty_ = _glob_result_pretty


_exports = ["gateway"]
_shutdown = []
_helper_functions = {}
gateway = _create_gateway(_callback, _gateway_call_async)
_exports.extend(["bash", "ls", "phase"])
_exports.extend(["glob"])

# The retained audit callback owns this trace state even after prelude replacement.
_trace = _SimpleNamespace(
    options=_config["trace"], enabled=True,
    # Recursion guard for the synchronous audit hook, not cell ownership.
    local=_threading.local(),
    prefixes=tuple({_trace_os.path.realpath(prefix) for prefix in (_sys.prefix, _sys.base_prefix)}),
    _operations={
        "os.rename": "rename", "os.remove": "delete", "os.rmdir": "delete",
        "os.mkdir": "write", "os.truncate": "write", "subprocess.Popen": "command",
        "os.system": "command", "os.exec": "command", "os.posix_spawn": "command",
    },
    _path_events={"open", "os.rename", "os.remove", "os.rmdir", "os.mkdir", "os.truncate"},
)
_trace.start = _MethodType(_trace_start, _trace)
_trace.stop = _MethodType(_trace_stop, _trace)
_trace.shutdown = _MethodType(_trace_shutdown, _trace)
_trace.record = _MethodType(_trace_record, _trace)
_sys.addaudithook(_trace.record)
_shutdown.append(_trace.shutdown)

# Own-scope cgroup charges include subprocesses; they are not process RSS.
_memory_config = _config["kernel"]
_memory_max = _memory_config["memoryMax"]
_memory_swap_max = _memory_config["memorySwapMax"]
_memory_interval = _memory_config["telemetryIntervalMs"] / 1000
_memory_expect_scope = _memory_config.get("scoped", True) and _os.environ.get("PRK_KERNEL_UNSCOPED") != "1"
if _memory_activity is None:
    _memory_activity = (_threading.Lock(), set())
_memory_lock, _memory_active = _memory_activity
if _memory_expect_scope:
    _memory_cgroup = next((line[3:] for line in _Path("/proc/self/cgroup").read_text().splitlines() if line.startswith("0::")), None)
    if _memory_cgroup is None:
        raise RuntimeError("PRK kernel requires cgroup v2 and a delegated memory controller")
    _memory_scope = _Path("/sys/fs/cgroup") / _memory_cgroup.lstrip("/")
    try:
        if _memory_scope.suffix != ".scope":
            raise RuntimeError("PRK kernel requires its own systemd user scope")
        for _memory_file, _memory_expected in (("memory.max", _memory_max), ("memory.swap.max", _memory_swap_max)):
            _memory_actual = (_memory_scope / _memory_file).read_text().strip()
            if _memory_actual != str(_memory_bytes(_memory_expected)):
                raise RuntimeError(f"PRK kernel limit mismatch: {_memory_file}={_memory_actual}, configured {_memory_expected}")
        _memory_current = int((_memory_scope / "memory.current").read_text())
    except OSError as _memory_error:
        raise RuntimeError("PRK kernel memory controller is unavailable; enable delegated cgroup-v2 memory on the target systemd user manager") from _memory_error
    _memory_baseline = _memory_previous["baseline"] if _memory_previous and _memory_previous["scope"] == str(_memory_scope) else _memory_current
    _memory_state = {"scope": str(_memory_scope), "baseline": _memory_baseline}
    _memory_stop = _threading.Event()
    _memory_published_oom = None
    _memory_publish()
    _memory_thread = _threading.Thread(target=_Context().run, args=(_memory_loop,), name="prk-memory", daemon=True)
    _memory_thread.start()
    _shutdown.append(_memory_cleanup)
else:
    _memory_state = None

_ns_options = _config["namespace"]
if _ns_state is None:
    _ns_state = _SimpleNamespace(lock=_threading.Lock(), captured=0, published=0,
                                 bindings={}, origins={}, entries={})
_ns_history_name = _re.compile(r"_(?:i(?:i|ii|\d+)?|\d+)")

# Stored tools run only in this kernel; Gateway owns their source and usage records.
_library_functions = {}
_library_entries = {}
_library_wrappers = {}
_library_availability = {}
_shutdown.append(_library_unload)
_exports.extend(["tool", "library_sync"])
_library_apply(_config.get("library", []))

_bin_verified = {}
_exports.extend(["tool_bin", "disk_usage"])
