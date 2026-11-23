import { dirname } from "node:path";
import { discoverKernelToolCatalog } from "../../codemode/module-catalog/discover-kernel-tool-catalog.ts";
import type { CapabilityCatalog } from "../../config/capabilities/capability-types.ts";
import { createNativeToolDefinitions } from "../native-coding/create-native-tool-definitions.ts";
import { createExtensionHandlerScope } from "../extension-invocation/assemble-extension-invocation.ts";
import type { CatalogContext, GatewayCapabilityCatalogInput } from "./catalog-types.ts";
import { createDiscoveryRuntime } from "./create-discovery-runtime.ts";
import { bindDiscoveryEvents } from "./bind-discovery-events.ts";
import { CapabilityDiscoveryError } from "./discovery-error.ts";
import { waitForMcpStartup } from "./await-mcp-startup.ts";
import { rejectFailures } from "./reject-discovery-errors.ts";
import { collectMetadata } from "./collect-metadata.ts";
import { formatCatalog } from "./format-catalog.ts";
import { notify } from "./notify.ts";
import { extensionStartupSource } from "./extension-startup-source.ts";

/** A disposable, all-on SDK session at the neutral PRK home discovers global metadata without a project, session, kernel, or model turn. */
export async function loadGatewayCapabilityCatalog(input: GatewayCapabilityCatalogInput): Promise<CapabilityCatalog> {
  input.signal?.throwIfAborted();
  const extensionHandlers = createExtensionHandlerScope(input.signal, (extension, { ui }) => ({
    ...ui,
    notify: (message, type) => notify(ctx, message, type, extensionStartupSource(extension.sourceInfo)),
  }));
  const nativeTools = createNativeToolDefinitions(input.cwd);
  const nativeNames = new Set(nativeTools.map((tool) => tool.name));
  const failures: string[] = [];
  const ctx: CatalogContext = { input, extensionHandlers, nativeTools, nativeNames, failures, pluginFailures: input.pluginFailures ?? new Map() };
  const runtime = await createDiscoveryRuntime(ctx);
  let failed: { error: unknown } | undefined;
  ctx.closing = false;
  try {
    rejectFailures(ctx);
    const session = runtime.session;
    await bindDiscoveryEvents(ctx, session);
    input.signal?.throwIfAborted();
    await waitForMcpStartup(ctx, session);
    input.signal?.throwIfAborted();
    rejectFailures(ctx);
    const skills = session.resourceLoader.getSkills();
    ctx.failures.push(...skills.diagnostics.filter((item) => item.type === "error").map((item) => `${item.path ?? "skill"}: ${item.message}`));
    rejectFailures(ctx);
  } catch (error) {
    failed = { error };
    throw error;
  } finally {
    ctx.closing = true;
    extensionHandlers.close();
    const cleanupErrors: unknown[] = [];
    // Remote handlers retain their public SDK context until the control shutdown finishes.
    try { await ctx.remoteLoad?.close(); } catch (error) { cleanupErrors.push(error); }
    try { await runtime.dispose(); } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) {
      const discovery = ctx.failures.length ? [new CapabilityDiscoveryError(ctx.failures)] : [];
      throw new AggregateError([...discovery, ...(failed ? [failed.error] : []), ...cleanupErrors], "Capability catalog cleanup failed.");
    }
    if (!failed) rejectFailures(ctx);
  }
  const collected = collectMetadata(ctx, runtime.session);
  const helpers = await discoverKernelToolCatalog(dirname(input.agentDir));
  return formatCatalog(ctx, collected, helpers);
}
