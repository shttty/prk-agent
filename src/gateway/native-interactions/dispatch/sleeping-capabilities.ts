import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { CapabilityChange, CapabilityChanges } from "../../../config/capabilities/capability-types.ts";
import { readNativeSessionState } from "../../../sessions/history/read-native-session-state.ts";
import { projectCapabilities } from "../../../sessions/resource-catalog/format-capabilities.ts";
import { validateCapabilityChanges } from "../../../sessions/resource-catalog/validate-capability-changes.ts";
import { LOCAL_TOOLS_GROUP } from "../../../sessions/resource-catalog/catalog-constants.ts";

export function sleepingCapabilities(ctx: HostContext, entry: StoredSession, changes: readonly CapabilityChange[] = []) {
  const native = readNativeSessionState(entry.manager, ctx.host.config.limits);
  const target = ctx.instances.targets.find((target) => target.id === entry.target);
  const overrides = { ...native.capabilities };
  const capabilities: CapabilityChanges = {};
  const state: { version: number; capabilities: CapabilityChanges; localTools?: boolean | null } = { version: 1, capabilities };
  let localTools = native.localTools;
  for (const { id, enabled } of changes) {
    if (id === LOCAL_TOOLS_GROUP) {
      localTools = enabled ?? undefined;
      state.localTools = enabled;
    } else {
      if (enabled === null) delete overrides[id]; else overrides[id] = enabled;
      capabilities[id] = enabled;
    }
  }
  const entries = ctx.capabilities.globalCapabilityCatalog.entries
    .filter((item) => !item.instance || item.instance === entry.target)
    .map((item) => ({ ...item, locked: item.id === "tool:kernel_code" && (native.toolMode ?? ctx.host.config.session.workerTools) === "code" }));
  const defaults = { ...ctx.capabilities.capabilityDefaults, capabilities: { ...ctx.capabilities.capabilityDefaults.capabilities, ...target?.capabilities } };
  const catalog = projectCapabilities(entries, defaults, overrides, localTools, target?.local === true, [], [overrides, target?.capabilities ?? {}, ctx.capabilities.capabilityDefaults.capabilities]);
  if (changes.length) {
    validateCapabilityChanges(catalog, changes, true);
    entry.manager.appendCustomEntry("gateway-native-session-state", state);
    ctx.methods.publishCapabilities(entry.sessionId);
  }
  return catalog;
}
