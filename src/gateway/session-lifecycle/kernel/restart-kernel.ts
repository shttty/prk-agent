import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { KernelSnapshot } from "../../../kernel/kernel-types.ts";

export function kernelRestart(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["kernelRestart"]>[0]): Promise<KernelSnapshot> { return ctx.methods.maintainSessionKernel(sessionId, "restart"); }
