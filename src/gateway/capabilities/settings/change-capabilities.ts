import type { HostContext } from "../../host/host-state.ts";
import type { CapabilityDefaults, CapabilitySettings, CapabilitySettingsChange } from "../../../config/capabilities/capability-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { readPrkConfigSnapshot } from "../../../config/document/read-prk-config-snapshot.ts";
import { readPrkInstanceSnapshot } from "../../../config/document/read-prk-instance-snapshot.ts";
import type { PrkConfig } from "../../../config/document/document-types.ts";
import { parsePrkConfig } from "../../../config/document/parse-prk-config.ts";
import { isCapabilityBatch } from "../../../config/capabilities/is-capability-batch.ts";
import { DEFAULT_SESSION_OPTIONS } from "../../../config/session/session-options.ts";
import { projectCapabilities } from "../../../sessions/resource-catalog/format-capabilities.ts";
import { validateCapabilityChanges } from "../../../sessions/resource-catalog/validate-capability-changes.ts";
import { LOCAL_TOOLS_CAPABILITY } from "../../../config/capabilities/capability-constants.ts";
import { gatewayLoadablePackages } from "../../remote-packages/list-loadable-packages.ts";
import { stageConfig } from "../../instances/stage-config.ts";
import { publishConfig } from "../../instances/publish-config.ts";
import { unlink } from "node:fs/promises";

export async function capabilitiesChange(ctx: HostContext, request: CapabilitySettingsChange): Promise<CapabilitySettings> {
    return ctx.methods.exclusive(async () => {
      if (!request || typeof request !== "object" || Array.isArray(request)) throw new WireError("INVALID_REQUEST", "Capability settings require an object.");
      const globalSnapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
      const instanceSnapshot = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
      const document = globalSnapshot.document ?? {};
      const instanceDocument = instanceSnapshot.document ?? { instances: [] };
      let nextConfig: PrkConfig;
      try { nextConfig = parsePrkConfig(document, instanceDocument); }
      catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
      const savedSession = document.session as Record<string, unknown> | undefined;
      const nextDefaults: CapabilityDefaults = {
        capabilities: { ...(savedSession?.capabilities === undefined ? ctx.capabilities.capabilityDefaults.capabilities : nextConfig.session.capabilities) },
        localTools: savedSession?.localTools === undefined ? ctx.capabilities.capabilityDefaults.localTools : nextConfig.session.localTools,
      };
      if ("terminal" in request) {
        if (Object.keys(request).some((key) => key !== "terminal") || !request.terminal || typeof request.terminal !== "object" || Array.isArray(request.terminal)) throw new WireError("INVALID_REQUEST", "Terminal settings require exactly {terminal: object}.");
        document.terminal = { ...ctx.workspace.terminalOptions, ...document.terminal as Record<string, unknown> | undefined, ...request.terminal };
      } else if ("instance" in request) {
        if (Object.keys(request).some((key) => key !== "instance" && key !== "changes")
          || typeof request.instance !== "string" || !request.instance.trim() || !isCapabilityBatch(request)
          || request.changes.some(({ id }) => id === LOCAL_TOOLS_CAPABILITY)) {
          throw new WireError("INVALID_REQUEST", "Instance capabilities require {instance, changes: [{id, enabled: boolean | null}, ...]}; local tools use session.localTools.");
        }
        if (ctx.host.options.targets !== undefined) throw new WireError("UNSUPPORTED_METHOD", "Instance settings cannot be persisted when targets are explicitly supplied.");
        const index = nextConfig.instances.findIndex((target) => target.id === request.instance);
        if (index < 0 || !ctx.instances.targets.some((target) => target.id === request.instance)) throw new WireError("NOT_FOUND", "Instance is not configured.");
        const capabilities = { ...nextConfig.instances[index]!.capabilities };
        for (const { id, enabled } of request.changes) {
          if (enabled === null) delete capabilities[id]; else capabilities[id] = enabled;
        }
        const { catalog } = await ctx.methods.instanceCapabilitiesList(request.instance);
        validateCapabilityChanges(projectCapabilities(catalog.entries, nextDefaults, capabilities, undefined, nextConfig.instances[index]!.local === true), request.changes, false, gatewayLoadablePackages(ctx));
        instanceDocument.instances = (instanceDocument.instances as Record<string, unknown>[]).map((target, position) => position === index ? { ...target, capabilities } : target);
      } else {
        if (Object.keys(request).some((key) => key !== "changes") || !isCapabilityBatch(request)) throw new WireError("INVALID_REQUEST", "Capabilities require exactly {changes: [{id, enabled: boolean | null}, ...]} with distinct IDs.");
        const session = { ...savedSession };
        for (const { id, enabled } of request.changes) {
          if (id === LOCAL_TOOLS_CAPABILITY) {
            nextDefaults.localTools = enabled ?? DEFAULT_SESSION_OPTIONS.localTools;
            if (enabled === null) delete session.localTools; else session.localTools = enabled;
          } else {
            if (enabled === null) delete nextDefaults.capabilities[id]; else nextDefaults.capabilities[id] = enabled;
            session.capabilities = nextDefaults.capabilities;
          }
        }
        const catalog = ctx.methods.capabilitiesList().catalog;
        validateCapabilityChanges(projectCapabilities(catalog.entries, nextDefaults, {}, undefined, true, [], [nextDefaults.capabilities]), request.changes, false, gatewayLoadablePackages(ctx));
        document.session = session;
      }
      try { nextConfig = parsePrkConfig(document, instanceDocument); }
      catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
      const savePath = "instance" in request ? ctx.instances.targetConfigPath : ctx.host.paths.configPath;
      const staged = await stageConfig(savePath, "instance" in request ? instanceDocument : document, "instance" in request ? 0o600 : undefined);
      try {
        if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; configuration was not changed.");
        publishConfig(savePath, staged, ("instance" in request ? instanceSnapshot : globalSnapshot).hash);
        if ("instance" in request) {
          const capabilities = nextConfig.instances.find((target) => target.id === request.instance)!.capabilities;
          ctx.instances.targets = ctx.instances.targets.map((target) => target.id === request.instance ? { ...target, capabilities } : target);
          ctx.host.collection.replaceTargets(ctx.instances.targets);
        } else ctx.capabilities.capabilityDefaults = nextDefaults;
        if ("terminal" in request) Object.assign(ctx.workspace.terminalOptions, nextConfig.terminal);
        for (const session of ctx.host.collection.snapshot()) {
          if (session.state === "closed" || session.state === "closing") continue;
          if ("instance" in request && session.target !== request.instance) continue;
          ctx.host.collection.get(session.sessionId)?.refreshCapabilities();
          ctx.methods.publishCapabilities(session.sessionId);
        }
        return ctx.methods.instanceCapabilitiesList("instance" in request ? request.instance : undefined);
      } finally {
        await unlink(staged.temporary).catch(() => { });
      }
    });
  }
