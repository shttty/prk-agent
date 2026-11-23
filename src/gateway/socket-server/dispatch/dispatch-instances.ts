import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { TargetConnection } from "../../instances/instance-types.ts";
import type { ExecutionTargetConfig, ExecutionTargetEdit } from "../../../config/execution-target/target-types.ts";
import type { BunPackagePins } from "../../../config/execution-target/validation/bun-package-options.ts";

export async function dispatchInstances(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "getTargetEnvironment") { respond(id, host.getTargetEnvironment({ target: params.target as string })); return; }
      if (method === "deployTargetEnvironment") { respond(id, host.deployTargetEnvironment({ target: params.target as string, bunPackages: params.bunPackages as BunPackagePins | undefined })); return; }
      if (method === "getTarget") {
        respond(id, host.getTarget(params.target as string)); return;
      }
      if (method === "addTarget") {
        respond(id, await host.addTarget({ target: params.target as ExecutionTargetConfig })); return;
      }
      if (method === "editTarget") {
        respond(id, await host.editTarget({ target: params.target as ExecutionTargetEdit })); return;
      }
      if (method === "inspectTarget") {
        respond(id, await host.inspectTarget({ connection: params.connection as unknown as TargetConnection })); return;
      }
      if (method === "browseTarget") {
        respond(id, await host.browseTarget({ connection: params.connection as unknown as TargetConnection, path: params.path as string })); return;
      }
      if (method === "assignProject") {
        const project = params.project === null ? null : params.project as { readonly id: string; readonly name: string };
        respond(id, host.assignProject(params.sessionId as string, project)); return;
      }
      if (method === "deleteTarget") {
        respond(id, await host.deleteTarget({ target: params.target as string, confirm: true })); return;
      }
}
