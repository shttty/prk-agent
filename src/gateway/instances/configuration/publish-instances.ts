import type { HostContext } from "../../host/host-state.ts";
import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import type { PublicExecutionTarget } from "../instance-types.ts";

export function publishTargets(ctx: HostContext, nextTargets: ExecutionTarget[], nextPublicTargets: readonly PublicExecutionTarget[]): void {
    ctx.instances.targets = nextTargets;
    ctx.instances.publicTargets = nextPublicTargets;
    for (const id of ctx.instances.environments.keys()) if (!nextTargets.some((target) => target.id === id)) ctx.instances.environments.delete(id);
    ctx.methods.refreshSessionControl();
    ctx.methods.reconcileMonitor();
  }
