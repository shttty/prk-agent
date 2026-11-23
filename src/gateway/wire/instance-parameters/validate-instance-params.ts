import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { parseKernelOptions } from "../../../config/kernel/parse-kernel-options.ts";
import { isExecutionTimeoutMs } from "../../../kernel/kernel-options.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { routingIdentifier } from "../fields/is-routing-identifier.ts";
import { fieldText } from "../fields/is-field-text.ts";
import { label } from "../fields/is-label.ts";
import { validAbsolutePath } from "./is-absolute-target-path.ts";
import { tags } from "./tags.ts";
import { isPythonIndexUrl } from "../../../config/python-index/is-python-index-url.ts";
import { isBunRegistry } from "../../../config/execution-target/validation/bun-package-options.ts";

const targetFields = ["id", "label", "local", "sshCommand", "python", "pythonIndexUrl", "bunPackages", "tags", "cwd", "executionTimeoutMs", "kernel"] as const;
export function validTarget(value: unknown, creating: boolean, limits: LimitsOptions): boolean {
  try { if (object(value) && value.kernel !== undefined) parseKernelOptions(value.kernel); }
  catch { return false; }
  return object(value) && keys(value, targetFields) && routingIdentifier(value.id, limits)
    && (value.sshCommand === undefined || (!creating && value.sshCommand === "") || (value.local !== true && fieldText(value.sshCommand, limits.sshCommandChars)))
    && ((!creating && value.label === undefined) || label(value.label, limits)) && (value.tags === undefined || tags(value.tags, limits))
    && (value.local === undefined || typeof value.local === "boolean")
    && (creating ? validAbsolutePath(value.cwd, limits) : value.cwd === undefined || validAbsolutePath(value.cwd, limits))
    && (value.python === undefined || (!creating && value.python === "") || validAbsolutePath(value.python, limits))
    && (value.pythonIndexUrl === undefined || (!creating && typeof value.pythonIndexUrl === "string" && !value.pythonIndexUrl.trim()) || isPythonIndexUrl(value.pythonIndexUrl))
    && (value.bunPackages === undefined || isBunRegistry(value.bunPackages))
    && (value.executionTimeoutMs === undefined || isExecutionTimeoutMs(value.executionTimeoutMs));
}
