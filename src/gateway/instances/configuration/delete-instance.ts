import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { WorkbenchSnapshot } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { persistedId } from "../match-persisted-id.ts";

export async function deleteTarget(ctx: HostContext, request: Parameters<GatewaySessionHost["deleteTarget"]>[0]): Promise<WorkbenchSnapshot> {
      if (ctx.host.options.targets !== undefined) {
        throw new WireError("UNSUPPORTED_METHOD", "Target configuration editing is unavailable when targets are explicitly supplied.");
      }
      if (request?.confirm !== true) throw new WireError("INVALID_REQUEST", "Deleting a target requires explicit confirmation.");
      if (typeof request.target !== "string" || !request.target.trim()) {
        throw new WireError("INVALID_REQUEST", "Target ID must be a non-empty string.");
      }
      return ctx.methods.exclusive(() => ctx.methods.mutatePersistedTargets((document, current) => {
        if (!current.some((target) => target.id === request.target)) {
          throw new WireError("NOT_FOUND", "Execution target is not configured; no configuration was changed.");
        }
        document.instances = document.instances.filter((entry) => !persistedId(entry, request.target));
      }));
    }
