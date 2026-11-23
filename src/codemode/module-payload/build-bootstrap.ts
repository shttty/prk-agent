import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KernelModuleConfig } from "./module-types.ts";
import { scan } from "./scan-kernel-modules.ts";
import { KERNEL_TOOL_CATALOG_MIME } from "../module-catalog/catalog-protocol.ts";
import { readPythonSource } from "../../target-channel/deployment-source/read-python-source.ts";

export async function kernelModuleBootstrap(home: string, config: KernelModuleConfig = {}, builtinDirectory = fileURLToPath(new URL("../../kernel-tools/", import.meta.url))): Promise<string> {
  const builtin = await scan(builtinDirectory);
  for (const [name, entry] of await scan(join(home, "kernel-tools"))) builtin.set(name, { ...entry, overridesBuiltin: builtin.has(name) });
  const loader = readPythonSource(new URL("../kernel-module-loader/", import.meta.url));
  const sdk = readPythonSource(new URL("../kernel-module-sdk/", import.meta.url));
  return [
    "_prk_loader = _prk_sys.modules.get('_prk_tool_loader')",
    "if _prk_loader is None:\n    _prk_loader = _prk_types.ModuleType('_prk_tool_loader')\n    _prk_sys.modules['_prk_tool_loader'] = _prk_loader",
    `    exec(${JSON.stringify(loader)}, _prk_loader.__dict__)`,
    `_prk._module_catalog = _prk_loader.install(_prk_json.loads(${JSON.stringify(JSON.stringify({ modules: [...builtin.values()], config }))}), _prk, ${JSON.stringify(sdk)})`,
    `_prk._display({${JSON.stringify(KERNEL_TOOL_CATALOG_MIME)}: _prk._module_catalog}, raw=True)`,
    "del _prk_loader",
  ].join("\n");
}
