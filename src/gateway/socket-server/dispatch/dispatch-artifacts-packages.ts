import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export async function dispatchArtifactsPackages(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "pluginsList") { respond(id, await host.pluginsList()); return; }
      if (method === "pluginsChange") { respond(id, await host.pluginsChange(params as unknown as Parameters<GatewaySessionHost["pluginsChange"]>[0])); return; }
      if (method === "pluginsInstall") { respond(id, await host.pluginsInstall(params as unknown as Parameters<GatewaySessionHost["pluginsInstall"]>[0])); return; }
      if (method === "pluginsUninstall") { respond(id, await host.pluginsUninstall(params as unknown as Parameters<GatewaySessionHost["pluginsUninstall"]>[0])); return; }
      if (method === "artifactsList") { respond(id, host.artifactsList()); return; }
      if (method === "artifactsUpload") { respond(id, await host.artifactsUpload(params as unknown as Parameters<GatewaySessionHost["artifactsUpload"]>[0])); return; }
      if (method === "artifactsCurrent") { respond(id, await host.artifactsCurrent(params.name as string, params.version as string)); return; }
      if (method === "artifactsDelete") { respond(id, await host.artifactsDelete(params.name as string, params.version as string)); return; }
}
