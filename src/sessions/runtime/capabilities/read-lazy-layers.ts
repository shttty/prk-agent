import type { CapabilitySwitches } from "../../../config/capabilities/capability-types.ts";
import { defaults } from "../configuration/read-defaults.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function lazyLayers(ctx: RuntimeContext): readonly CapabilitySwitches[] {
  const inherited = ctx.dependencies.capabilityLayers?.(ctx.target.id)
    ?? (ctx.dependencies.capabilityDefaults ? [defaults(ctx).capabilities] : [ctx.target.capabilities ?? {}, ctx.sessionOptions.capabilities]);
  return [ctx.capabilityOverrides, ...inherited];
}
