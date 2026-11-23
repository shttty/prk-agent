import type { HostContext } from "../host/host-state.ts";
import type { KernelExecutionSettings } from "../../config/kernel/kernel-options.ts";

export function kernelExecutionGet(ctx: HostContext): KernelExecutionSettings {
  return { asyncExecution: ctx.host.config.kernel.asyncExecution };
}
