import { DEFAULT_KERNEL_RUNTIME_OPTIONS, type KernelRuntimeOptions, type KernelExecutionPolicy } from "../../kernel/kernel-options.ts";
export interface KernelOptions extends KernelRuntimeOptions {
  readonly memoryMax: string;
  readonly memorySwapMax: string;
}

export const DEFAULT_KERNEL_OPTIONS: KernelOptions = Object.freeze({
  ...DEFAULT_KERNEL_RUNTIME_OPTIONS, memoryMax: "4G", memorySwapMax: "0",
});

export type GlobalKernelOptions = KernelOptions & KernelExecutionPolicy;

export type KernelExecutionSettings = Pick<GlobalKernelOptions, "asyncExecution">;
