import type { KernelExecutionSettings } from "./kernel-options.ts";

export function isKernelExecutionSettings(value: unknown): value is KernelExecutionSettings {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, "asyncExecution")
    && typeof (value as Record<string, unknown>).asyncExecution === "boolean";
}
