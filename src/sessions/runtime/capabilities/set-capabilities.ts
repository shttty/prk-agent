import { LOCAL_TOOLS_GROUP } from "../../resource-catalog/catalog-constants.ts";
import { validateCapabilityChanges } from "../../resource-catalog/validate-capability-changes.ts";
import type { CapabilityChange, CapabilityChanges } from "../../../config/capabilities/capability-types.ts";
import { isCapabilityBatch } from "../../../config/capabilities/is-capability-batch.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { capabilityCatalog } from "./get-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { refreshCapabilities } from "./refresh-capabilities.ts";

export function setCapabilities(ctx: RuntimeContext, changes: readonly CapabilityChange[]): void {
  if (!isCapabilityBatch({ changes })) throw new WireError("INVALID_REQUEST", "Capability batches require nonempty changes with distinct IDs.");
  const proposed = { ...ctx, capabilityOverrides: { ...ctx.capabilityOverrides } };
  const capabilities: CapabilityChanges = {};
  const state: { version: number; capabilities: CapabilityChanges; localTools?: boolean | null } = { version: 1, capabilities };
  for (const { id, enabled } of changes) {
    if (id === LOCAL_TOOLS_GROUP) {
      proposed.localOverride = enabled ?? undefined;
      state.localTools = enabled;
    } else {
      if (enabled === null) delete proposed.capabilityOverrides[id]; else proposed.capabilityOverrides[id] = enabled;
      capabilities[id] = enabled;
    }
  }
  validateCapabilityChanges(capabilityCatalog(proposed), changes, true);
  ctx.sessionManager.appendCustomEntry("gateway-native-session-state", state);
  ctx.capabilityOverrides = proposed.capabilityOverrides;
  ctx.localOverride = proposed.localOverride;
  refreshCapabilities(ctx);
}
