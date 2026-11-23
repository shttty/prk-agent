import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { WireError } from "../wire/create-error.ts";

export function toolsList(ctx: HostContext, target: Parameters<GatewaySessionHost["toolsList"]>[0]): ReturnType<GatewaySessionHost["toolsList"]> {
      if (target !== undefined && !ctx.instances.targets.some((entry) => entry.id === target)) throw new WireError("NOT_FOUND", "Execution target is not configured.");
      return { tools: ctx.host.toolLibrary.list(target) };
    }
