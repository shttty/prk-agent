import type { KernelSnapshot } from "../../../../src/gateway/wire/web-types.ts";

// Live frames omit an unchanged namespace; keep it for the same live kernel.
export function mergeLiveKernel(previous: KernelSnapshot | undefined, kernel: KernelSnapshot): KernelSnapshot {
  return !kernel.namespace && previous?.namespace && previous.kernelId === kernel.kernelId && (kernel.state === "idle" || kernel.state === "busy")
    ? { ...kernel, namespace: previous.namespace } : kernel;
}
