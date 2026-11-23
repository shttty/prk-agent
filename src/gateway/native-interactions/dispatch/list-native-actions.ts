import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { NativeCatalog } from "../../../sessions/native-interaction/native-types.ts";

export function nativeCapabilities(ctx: HostContext, sessionId: string): NativeCatalog {
      const catalog = ctx.native.nativeInteractions.catalog(ctx.methods.nativeTarget(sessionId));
      return { ...catalog, actions: [...catalog.actions, { name: "acknowledge-model-fallback", effect: "presentation", risk: "none", enabled: ctx.models.modelFallbacks.has(sessionId) }] };
    }
