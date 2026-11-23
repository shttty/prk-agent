import { DEFAULT_KERNEL_OPTIONS, type KernelOptions } from "./kernel-options.ts";
import { memoryLimitBytes } from "./parse-memory-limit-bytes.ts";
import { isExecutionTimeoutMs } from "../../kernel/kernel-options.ts";

export function parseKernelOptions(value: unknown, defaults: KernelOptions = DEFAULT_KERNEL_OPTIONS, name = "kernel"): KernelOptions {
  if (value === undefined) return { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid PRK configuration: ${name} must be an object.`);
  const options = { ...defaults };
  for (const [key, option] of Object.entries(value)) {
    try {
      if (key === "memoryMax" || key === "memorySwapMax") {
        memoryLimitBytes(option, key === "memorySwapMax");
      } else if (key === "executionTimeoutMs") {
        if (!isExecutionTimeoutMs(option)) throw new Error("must be an integer from 0 to 2147483647");
      } else if (Object.hasOwn(DEFAULT_KERNEL_OPTIONS, key) && typeof DEFAULT_KERNEL_OPTIONS[key as keyof KernelOptions] === "number") {
        const max = key.endsWith("Ms") ? 2_147_483_647 : Number.MAX_SAFE_INTEGER;
        if (typeof option !== "number" || !Number.isSafeInteger(option) || option < 1 || option > max) throw new Error(`must be an integer from 1 to ${max}`);
      } else throw new Error("unsupported field");
    } catch (error) {
      throw new Error(`Invalid PRK configuration: ${name}.${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
    Object.assign(options, { [key]: option });
  }
  return options;
}
