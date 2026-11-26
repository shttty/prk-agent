import type { TargetEnvironmentSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import type { TargetEnvironmentView } from "./target-types.ts";
import { patch } from "../updates/patch.ts";
import { newerEnvironment } from "./newer-environment.ts";

/** Merges one instance's environment snapshot (collection event, POST answer or DEPLOYMENT_FAILED details) into
 * `state.targets`; unknown instances are ignored. Returns the environment the page now holds. Pure byte progress (the
 * Gateway reports every chunk ACK) is drawn once per animation frame like other high-rate display data; status
 * changes notify at once. */
export function applyTargetEnvironment(ctx: StoreContext, environment: TargetEnvironmentSnapshot | null): TargetEnvironmentView | null {
  if (!environment) return null;
  const index = ctx.state.targets.findIndex((target) => target.id === environment.target);
  const current = ctx.state.targets[index];
  if (!current) return null;
  const kept = newerEnvironment(current.environment, environment);
  if (kept !== current.environment) {
    const targets = [...ctx.state.targets];
    targets[index] = { ...current, environment: kept };
    const progressOnly = current.environment?.streamId === kept.streamId && current.environment.status === "transferring" && kept.status === "transferring";
    patch(ctx, { targets }, { displayOnly: progressOnly });
  }
  return kept;
}
