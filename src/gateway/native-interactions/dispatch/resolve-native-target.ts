import type { HostContext } from "../../host/host-state.ts";
import type { NativeTarget } from "../../../sessions/native-interaction/native-types.ts";
import { readNativeSessionState } from "../../../sessions/history/read-native-session-state.ts";
import type { ToolMode } from "../../../config/session/session-options.ts";
import type { DelegationLevel } from "../../../config/session/delegation-levels.ts";
import type { CapabilityChange } from "../../../config/capabilities/capability-types.ts";
import { sleepingCapabilities } from "./sleeping-capabilities.ts";

export function nativeTarget(ctx: HostContext, sessionId: string): NativeTarget {
    const entry = ctx.methods.storedSession(sessionId);
    const runtime = !entry.sleeping ? ctx.host.collection.get(sessionId) : undefined;
    const host = runtime ? ctx.methods.sessionHost(sessionId) : undefined;
    // Only the stream identity and state are needed here, never a cloned or projected snapshot.
    const { streamId, state } = host ?? ctx.methods.archivedStream(entry);
    const configured = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
    const referenceCandidates = configured
      ? (path = "") => ctx.workspace.files.referenceCandidates(ctx.methods.workspaceContext(sessionId), path.trim())
      : undefined;
    const readReference = configured
      ? (path: string) => ctx.workspace.files.readReference(ctx.methods.workspaceContext(sessionId), path)
      : undefined;
    const nativeState = readNativeSessionState(entry.manager, ctx.host.config.limits);
    return {
      sessionId: entry.sessionId,
      streamId,
      modelProviders: ctx.models.modelProviders,
      target: entry.target,
      local: configured?.local === true,
      rename: (label) => ctx.methods.renameSession(sessionId, label),
      toolMode: runtime?.toolMode ?? nativeState.toolMode ?? ctx.host.config.session.workerTools,
      kernelLanguage: nativeState.kernelLanguage ?? "python",
      kernelBusy: runtime?.setKernelLanguage && runtime.kernel.hasInFlightCell?.(),
      delegation: runtime?.delegation ?? nativeState.delegation ?? ctx.host.config.session.delegation,
      localTools: runtime?.localTools ?? nativeState.localTools ?? (configured?.local === true && ctx.capabilities.capabilityDefaults.localTools),
      requiresReload: runtime?.requiresReload ?? false,
      modelRuntime: runtime?.session.modelRuntime ?? ctx.models?.resolvedModelRuntime,
      onModelChange: () => { ctx.models.modelFallbacks.delete(sessionId); ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true); },
      ...(runtime ? {
        setToolMode: (mode: ToolMode) => { runtime.setToolMode(mode); ctx.methods.publishCapabilities(sessionId); },
        setKernelLanguage: runtime.setKernelLanguage,
        setDelegation: (level: DelegationLevel) => { runtime.setDelegation(level); ctx.methods.publishCapabilities(sessionId); },
        setLocalTools: (enabled: boolean) => { runtime.setLocalTools(enabled); ctx.methods.publishCapabilities(sessionId); },
        capabilityCatalog: () => runtime.capabilityCatalog(),
        refreshRegistration: () => runtime.refreshRegistration(),
        setCapabilities: (changes: readonly CapabilityChange[]) => { runtime.setCapabilities(changes); ctx.methods.publishCapabilities(sessionId); },
      } : entry.sleeping ? {
        setToolMode: (toolMode: ToolMode) => { entry.manager.appendCustomEntry("gateway-native-session-state", { version: 1, toolMode }); ctx.methods.publishCapabilities(sessionId); },
        setDelegation: (delegation: DelegationLevel) => { entry.manager.appendCustomEntry("gateway-native-session-state", { version: 1, delegation }); ctx.methods.publishCapabilities(sessionId); },
        setLocalTools: (localTools: boolean) => { entry.manager.appendCustomEntry("gateway-native-session-state", { version: 1, localTools }); ctx.methods.publishCapabilities(sessionId); },
        capabilityCatalog: () => sleepingCapabilities(ctx, entry),
        setCapabilities: (changes: readonly CapabilityChange[]) => { sleepingCapabilities(ctx, entry, changes); },
      } : {}),
      state,
   readOnly: !entry.sleeping && (runtime === undefined || state === "closed" || state === "closing"),
      ...(runtime === undefined ? {} : { session: runtime.session }),
      ...(host === undefined ? {} : { host }),
      ...(referenceCandidates === undefined ? {} : { referenceCandidates }),
      ...(readReference === undefined ? {} : { readReference }),
      manager: entry.manager,
    };
  }
