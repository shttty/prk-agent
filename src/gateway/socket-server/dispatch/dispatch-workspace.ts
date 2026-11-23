import type { PeerContext, Respond } from "../connection/peer-state.ts";
import { dispatchDownload } from "../download/dispatch-download.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { WorkspaceMethod } from "../../../workspace/requests/requests-types.ts";

export async function dispatchWorkspace(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  if (method === "filesDownload" || method === "filesDownloadNext") return dispatchDownload(ctx, respond, request);
  const { host } = ctx.listener;
  respond(id, await host.workspace(method as WorkspaceMethod, params.sessionId as string, params)); return;
}
