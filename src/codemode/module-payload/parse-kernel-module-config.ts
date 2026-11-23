import type { KernelModuleConfig } from "./module-types.ts";

export function parseKernelModuleConfig(value: unknown): KernelModuleConfig {
  if (value === undefined) return {};
  rejectNull(value, "kernelTools");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PRK configuration: kernelTools must be an object.");
  for (const [name, config] of Object.entries(value)) {
    if (!/^[A-Za-z]\w*$/u.test(name) || !config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("Invalid PRK configuration: kernelTools must map module names to configuration objects.");
    }
  }
  return value as KernelModuleConfig;
}

function rejectNull(value: unknown, path: string): void {
  if (value === null) throw new Error(`Invalid PRK configuration: ${path} must not be null.`);
  if (Array.isArray(value)) value.forEach((item, index) => rejectNull(item, `${path}[${index}]`));
  else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) rejectNull(item, `${path}.${key}`);
  }
}
