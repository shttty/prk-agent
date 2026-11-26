import { DEFAULT_TRACE_OPTIONS } from "../../config/trace/trace-options.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../../config/codemode/codemode-options.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../config/kernel/kernel-options.ts";
import { DEFAULT_NAMESPACE_OPTIONS } from "../../config/namespace/namespace-options.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../config/target-cache/target-cache-options.ts";
import { dirname } from "node:path";
import { resolvePrkHome } from "../../config/home/resolve-prk-home.ts";
import { kernelModuleBootstrap } from "../module-payload/build-bootstrap.ts";
import { parseKernelModuleConfig } from "../module-payload/parse-kernel-module-config.ts";
import { readPythonSource } from "../../target-channel/deployment-source/read-python-source.ts";

export async function kernelPrelude(config: Readonly<Record<string, unknown>> = {}): Promise<string> {
  const source = readPythonSource(new URL("./", import.meta.url));
  const home = typeof config.moduleHome === "string" ? config.moduleHome
    : process.env.PRK_CODING_AGENT_DIR ? dirname(process.env.PRK_CODING_AGENT_DIR) : resolvePrkHome();
  const modules = await kernelModuleBootstrap(home, parseKernelModuleConfig(config.kernelTools));
  return [
    "import json as _prk_json, sys as _prk_sys, types as _prk_types",
    "_prk_previous = _prk_sys.modules.get('__prk__')",
    "_prk_cleanup = None",
    "if _prk_previous is not None:\n    for _prk_cleanup in _prk_previous._shutdown:\n        _prk_cleanup()",
    "_prk = _prk_types.ModuleType('__prk__')",
    "_prk._memory_previous = getattr(_prk_previous, '_memory_state', None)",
    "_prk._memory_activity = getattr(_prk_previous, '_memory_activity', None)",
    "_prk._ns_state = getattr(_prk_previous, '_ns_state', None)",
    "_prk._namespace = _prk_runtime.namespace",
    "_prk._display = _prk_runtime.display",
    "_prk._callback = _prk_runtime.callback",
    "_prk._current_cell = _prk_runtime.current_cell",
    "_prk._write = _prk_runtime.write",
    `_prk._config = _prk_json.loads(${JSON.stringify(JSON.stringify({ codemode: DEFAULT_CODEMODE_OPTIONS, targetCacheRoot: DEFAULT_TARGET_CACHE_ROOT, trace: DEFAULT_TRACE_OPTIONS, kernel: DEFAULT_KERNEL_OPTIONS, namespace: DEFAULT_NAMESPACE_OPTIONS, ...config }))})`,
    "_prk_sys.modules['__prk__'] = _prk",
    `exec(${JSON.stringify(source)}, _prk.__dict__)`,
    "_prk._helper_functions = {name: getattr(_prk, name) for name in _prk._exports if callable(getattr(_prk, name)) and name not in _prk._library_entries}",
    "for _prk_name, _prk_function in _prk._helper_functions.items():\n    setattr(_prk, _prk_name, _prk._guard_helper(_prk_name, _prk_function))",
    modules,
    "_prk._namespace.update({**{name: getattr(_prk, name) for name in _prk._exports}, '__prk__': _prk})",
    "del _prk_json, _prk_sys, _prk_types, _prk_previous, _prk_cleanup, _prk_name, _prk_function",
  ].join("\n");
}
