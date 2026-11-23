import type { HostContext } from "../host/host-state.ts";
import { DEFAULT_DERIVATION_ROLES, DEFAULT_DERIVED_INSTRUCTIONS, DEFAULT_MAX_DERIVATION_DEPTH, type DerivationSettings } from "../../config/derivation/derivation-types.ts";

export function derivationGet(ctx: HostContext): DerivationSettings {
  return {
    derivation: ctx.derivation.derivationConfig,
    defaults: {
      defaultToolMode: ctx.host.config.session.workerTools,
      defaultIsolated: false,
      maxDepth: DEFAULT_MAX_DERIVATION_DEPTH,
      defaultInstructions: DEFAULT_DERIVED_INSTRUCTIONS,
      roles: DEFAULT_DERIVATION_ROLES,
    },
  };
}
