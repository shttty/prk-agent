import type { HostContext } from "../../host/host-state.ts";
import type { KernelSnapshot } from "../../../kernel/kernel-types.ts";

export function kernelUnusable(ctx: HostContext, runtime: { readonly kernel: { getSnapshot(): KernelSnapshot } }): boolean { return ["failed", "unavailable"].includes(runtime.kernel.getSnapshot().state); }
