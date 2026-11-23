import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

/** Operator edit; `instance` / `project` pick the scoped file of an instance- or project-scoped layer. */
export function memoryChange(ctx: HostContext, request: Parameters<GatewaySessionHost["memoryChange"]>[0]): ReturnType<GatewaySessionHost["memoryChange"]> {
  const { instance, project, ...operation } = request;
  ctx.host.memoryStore.apply(operation, {
    sessionId: "human", source: "human",
    instance: typeof instance === "string" ? instance : "",
    ...(typeof project === "string" ? { project } : {}),
  });
  return ctx.api.memoryList();
}
