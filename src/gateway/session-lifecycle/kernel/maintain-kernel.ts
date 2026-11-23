import type { HostContext } from "../../host/host-state.ts";
import type { KernelSnapshot } from "../../../kernel/kernel-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";

export async function maintainSessionKernel(ctx: HostContext, sessionId: string, action: "clear" | "restart" | { deleteVariable: string }): Promise<KernelSnapshot> {
    if (ctx.lifecycle.transitions.has(sessionId)) throw new WireError("BUSY", "Session is changing; kernel action was not submitted.");
    return ctx.methods.changeSessionRuntime(sessionId, async () => {
      const entry = ctx.methods.storedSession(sessionId);
      const runtime = !entry.sleeping ? ctx.host.collection.get(sessionId) : undefined;
      if (!runtime) throw new WireError("UNAVAILABLE", "Session has no available runtime; kernel actions never wake or create one.");
      const host = runtime.host.getSnapshot();
      if (host.state !== "idle" || !runtime.session.isIdle || runtime.session.isCompacting || runtime.session.pendingMessageCount > 0) {
        throw new WireError(host.state === "closed" ? "UNAVAILABLE" : "BUSY", "Session must be idle for a kernel action.");
      }
      const kernel = runtime.kernel.getSnapshot();
      if (runtime.kernel.hasInFlightCell?.() || kernel.state === "busy" || kernel.state === "starting") throw new WireError("BUSY", "Kernel is busy.");
      if (kernel.state !== "idle" || kernel.connectionStatus !== "connected") throw new WireError("UNAVAILABLE", "Kernel is unavailable; the next message starts a new one.");
      try {
        return await (typeof action === "object" ? runtime.kernel.deleteVariable(action.deleteVariable)
          : action === "restart" ? runtime.kernel.restart() : runtime.kernel.clear());
      } catch (error) {
        if (error instanceof WireError) throw error;
        throw new WireError("UNAVAILABLE", describeError(error, ctx.host.config.session));
      }
    });
  }
