import { patch } from "../updates/patch.js";
import { newerEnvironment } from "./newer-environment.js";
/** Merges one instance's environment snapshot (collection event, POST answer or ENVIRONMENT_REQUIRED details) into
 * `state.targets`; unknown instances are ignored. Returns the environment the page now holds. Pure byte progress (the
 * Gateway reports every chunk ACK) is drawn once per animation frame like other high-rate display data; status
 * changes notify at once. */
export function applyTargetEnvironment(ctx, environment) {
  if (!environment) return null;
  const index = ctx.state.targets.findIndex((target) => target.id === environment.target);
  if (index < 0) return null;
  const current = ctx.state.targets[index];
  const kept = newerEnvironment(current.environment, environment);
  if (kept !== current.environment) {
    const targets = [...ctx.state.targets];
    targets[index] = { ...current, environment: kept };
    const progressOnly = current.environment?.streamId === kept.streamId && current.environment.status === "transferring" && kept.status === "transferring";
    patch(ctx, { targets }, { displayOnly: progressOnly });
  }
  return kept;
}
