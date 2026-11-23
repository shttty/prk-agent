import type { KernelSnapshot } from "../../../kernel/kernel-types.ts";
import type { HostContext } from "../host-types.ts";
import { emit } from "./publish-event.ts";

// Live frames carry the namespace list only when it changed; snapshots always carry it whole.
export function observeKernel(ctx: HostContext, snapshot: KernelSnapshot): void {
  if (ctx.active?.pythonStarted && snapshot.lastOutcome === "unknown") ctx.active.unknown = true;
  const { namespace, ...withoutNamespace } = snapshot;
  const unchanged = namespace !== undefined && namespace === ctx.lastNamespace;
  ctx.lastNamespace = namespace;
  emit(ctx, "state_changed", { details: { kernel: unchanged ? withoutNamespace : snapshot } });
}
