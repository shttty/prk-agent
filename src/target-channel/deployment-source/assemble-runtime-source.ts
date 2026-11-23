import { readPythonSource } from "./read-python-source.ts";
import FILE_LIMITS from "../target-files/file-limits.json" with { type: "json" };
import EXTENSION_LIMITS from "../target-extensions/extension-limits.json" with { type: "json" };
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../config/target-cache/target-cache-options.ts";

const runtimeSource = readPythonSource(new URL("../target-runtime/", import.meta.url));
export const TARGET_CHANNEL_VERSION = Number(/^VERSION = (\d+)$/mu.exec(runtimeSource)?.[1]);
if (!Number.isSafeInteger(TARGET_CHANNEL_VERSION)) throw new Error("runtime.py declares no VERSION.");
const modulePlaceholder = "__TARGET_CHANNEL_MODULE_SOURCES__";
if (!runtimeSource.includes(modulePlaceholder)) throw new Error("runtime.py declares no module sources placeholder.");
export const TARGET_MODULE_SOURCES = {
  monitor: readPythonSource(new URL("../../monitor/collector/", import.meta.url)),
  skills: readPythonSource(new URL("../target-resources/", import.meta.url)),
  files: Object.entries(FILE_LIMITS).map(([name, value]) => `${name} = ${value}`).join("\n")
    + "\n\n" + readPythonSource(new URL("../target-files/", import.meta.url)),
  customMetrics: readPythonSource(new URL("../target-metrics/", import.meta.url)),
  remoteExtensions: `DEFAULT_TARGET_CACHE_ROOT = ${JSON.stringify(DEFAULT_TARGET_CACHE_ROOT)}\n` + Object.entries(EXTENSION_LIMITS).map(([name, value]) => `${name} = ${value}`).join("\n")
    + "\n\n" + readPythonSource(new URL("../target-extensions/", import.meta.url)),
  worktrees: readPythonSource(new URL("../target-worktrees/", import.meta.url)),
};
const moduleBody = runtimeSource.replace(modulePlaceholder, () => JSON.stringify(TARGET_MODULE_SOURCES));
export function assembleRuntimeSource(limits: ProcessWindowLimits = parseProcessWindowLimits()): string {
  return `PROCESS_LIMITS = ${JSON.stringify(limits)}\n` + moduleBody;
}
