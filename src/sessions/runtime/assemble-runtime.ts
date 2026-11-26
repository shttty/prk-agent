import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { SessionHost } from "../host/host-types.ts";
import type { HostedExtensionUI } from "../extension-ui/ui-types.ts";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { ToolMode } from "../../config/session/session-options.ts";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";
import { capabilityCatalog } from "./capabilities/get-catalog.ts";
import { createConversation } from "./lifecycle/start-conversation.ts";
import type { SessionRuntimeDependencies } from "./runtime-types.ts";
import type { SessionRuntime } from "./runtime-types.ts";
import { getSession } from "./conversation/get-session.ts";
import { getHost } from "./conversation/get-host.ts";
import { getExtensionUi } from "./conversation/get-extension-ui.ts";
import { getTerminalActive } from "./conversation/has-active-terminals.ts";
import { getToolMode } from "./tools/get-tool-mode.ts";
import { setToolMode } from "./tools/set-tool-mode.ts";
import { setKernelLanguage } from "./kernel/set-kernel-language.ts";
import { setDelegation } from "./delegation/set-level.ts";
import { getLocalTools } from "./tools/get-local-tools.ts";
import { setLocalTools } from "./tools/set-local-tools.ts";
import { setCapabilities } from "./capabilities/set-capabilities.ts";
import { refreshCapabilities } from "./capabilities/refresh-capabilities.ts";
import { reload } from "./lifecycle/reload.ts";
import { close } from "./lifecycle/close.ts";
import type { RuntimeContext } from "./runtime-state.ts";
import { initializeRuntime } from "./lifecycle/initialize-runtime.ts";
import { cleanupStartFailure } from "./lifecycle/cleanup-start-failure.ts";
import { refreshRegistration } from "./resources/registration/refresh-registration.ts";
import { refreshToolDeclarations } from "./tools/refresh-declarations.ts";

/** Construct the same session-owned SDK conversation, host and Python client. */
export async function createSessionRuntime(target: ExecutionTarget, dependencies: SessionRuntimeDependencies): Promise<SessionRuntime> {
  const ctx = { target, dependencies } as RuntimeContext;
  await initializeRuntime(ctx);
  ctx.active = await createConversation(ctx).catch(cleanupStartFailure.bind(undefined, ctx));
  ctx.closePromise = undefined;
  let observedReload = false;
  const observedCatalog = capabilityCatalog.bind(undefined, ctx, (pending, describe) => {
    if (pending && !observedReload) {
      console.error(`[${new Date().toISOString()}] Session ${ctx.sessionManager.getSessionId()}: requiresReload ${JSON.stringify(describe())}`);
    }
    observedReload = pending;
  });
  return {
    get session(): AgentSession { return getSession(ctx); },
    get host(): SessionHost { return getHost(ctx); },
    get extensionUi(): HostedExtensionUI { return getExtensionUi(ctx); },
    kernel: ctx.python,
    get terminalActive(): boolean { return getTerminalActive(ctx); },
    get toolMode(): ToolMode { return getToolMode(ctx); },
    setToolMode: setToolMode.bind(undefined, ctx),
    setKernelLanguage: setKernelLanguage.bind(undefined, ctx),
    get delegation(): DelegationLevel { return ctx.delegation; },
    setDelegation: setDelegation.bind(undefined, ctx),
    get localTools(): boolean { return getLocalTools(ctx); },
    setLocalTools: setLocalTools.bind(undefined, ctx),
    capabilityCatalog: observedCatalog,
    setCapabilities: setCapabilities.bind(undefined, ctx),
    refreshCapabilities: refreshCapabilities.bind(undefined, ctx),
    refreshToolDeclarations: refreshToolDeclarations.bind(undefined, ctx),
    promptReport: ctx.promptCapture.report,
    refreshRegistration: refreshRegistration.bind(undefined, ctx),
    get requiresReload(): boolean { return observedCatalog().requiresReload; },
    reload: reload.bind(undefined, ctx),
    close: close.bind(undefined, ctx),
  };
}
