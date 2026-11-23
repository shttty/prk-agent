import type { HostContext } from "../../host/host-state.ts";
import { KERNEL_ORPHAN_MESSAGE } from "../kernel-constants.ts";

export function markKernelOrphan(ctx: HostContext, sessionId: string): void {
    console.error(`Session ${sessionId}: ${KERNEL_ORPHAN_MESSAGE}`);
    ctx.methods.markUnavailable(sessionId, KERNEL_ORPHAN_MESSAGE);
  }
