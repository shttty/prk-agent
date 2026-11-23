import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { WorkbenchSnapshot } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { loadPrkConfig } from "../../../config/document/load-prk-config.ts";
import { sanitizeTargets } from "../format-public-instances.ts";
import { ExecutionTargetBusyError } from "../../../sessions/collection/create-execution-target-busy-error.ts";
import { parseDerivationConfig } from "../../../config/derivation/parse-config.ts";

export async function reloadTargets(ctx: HostContext): Promise<WorkbenchSnapshot> {
      if (ctx.host.options.targets !== undefined) {
        throw new WireError("UNSUPPORTED_METHOD", "Target reload is unavailable when targets are explicitly supplied.");
      }
      return ctx.methods.exclusive(async () => {
        try {
          const nextConfig = await loadPrkConfig(ctx.host.paths.home);
          const nextTargets = [...nextConfig.instances];
          const nextDerivationConfig = ctx.host.options.derivation === undefined ? nextConfig.derivation : parseDerivationConfig({ derivation: ctx.host.options.derivation });
          const nextPublicTargets = sanitizeTargets(nextTargets);
          if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; targets were not reloaded.");
          try {
            ctx.host.collection.replaceTargets(nextTargets);
          } catch (error) {
            if (error instanceof ExecutionTargetBusyError) throw new WireError("BUSY", error.message);
            throw error;
          }
          ctx.methods.publishTargets(nextTargets, nextPublicTargets);
          ctx.packages.extensionConfig = nextConfig.extensions;
          ctx.capabilities.instanceExtensionCatalogs.clear();
          ctx.packages.remoteCatalogStatuses.clear();
          for (const session of ctx.host.collection.snapshot()) ctx.methods.publishCapabilities(session.sessionId);
          ctx.derivation.derivationConfig = nextDerivationConfig;
          console.error(`[${new Date().toISOString()}] Gateway session targets reloaded (${nextTargets.length}).`);
          return ctx.methods.workbenchSnapshot();
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Gateway session target reload failed; existing configuration retained.`);
          throw error;
        }
      });
    }
