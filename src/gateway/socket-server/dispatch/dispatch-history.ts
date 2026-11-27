import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { SessionManagementRequest } from "../../wire/wire-types.ts";
import type { PromptPartRequest } from "../../../sessions/prompt-capture/capture-types.ts";

export async function dispatchHistory(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "renameProject") {
        respond(id, host.renameProject(params.projectId as string, params.name as string)); return;
      }
      if (method === "archiveProjectPreview") {
        respond(id, host.archiveProjectPreview(params.projectId as string)); return;
      }
      if (method === "archiveProject") {
        respond(id, await host.archiveProject(params.projectId as string, { confirm: true })); return;
      }
      if (method === "history") {
        respond(id, host.history(params.sessionId as string));
        return;
      }
      if (method === "historyPage") {
        respond(id, host.historyPage(params.sessionId as string, { before: params.before as string | undefined, through: params.through as string | null | undefined })); return;
      }
      if (method === "toolContent") {
        respond(id, host.toolContent(params.sessionId as string, params.toolCallId as string)); return;
      }
      if (method === "sessionPrompt") {
        respond(id, host.sessionPrompt(params.sessionId as string)); return;
      }
      if (method === "sessionPromptPart") {
        respond(id, host.sessionPromptPart(params.sessionId as string, { part: params.part as PromptPartRequest["part"], offset: params.offset as number | undefined, limit: params.limit as number | undefined })); return;
      }
      if (method === "kernelResult") {
        respond(id, host.kernelResult(params.sessionId as string, params.cellId as string, params.imageIndex as number | undefined)); return;
      }
      if (method === "renameSession") {
        respond(id, await host.renameSession(params.sessionId as string, params.label as string));
        return;
      }
      if (method === "archiveSession") {
        await host.archiveSession(params.sessionId as string, { confirm: true });
        respond(id, { ok: true });
        return;
      }
      if (method === "archivePreview") {
        respond(id, host.archivePreview(params.sessionId as string));
        return;
      }
      if (method === "unarchive") {
        respond(id, await host.unarchive(params.group as string));
        return;
      }
      if (method === "purgeArchive") {
        respond(id, await host.purgeArchive(params.group as string, { confirm: true }));
        return;
      }
      if (method === "manageSession") {
        const { sessionId: _sessionId, ...request } = params;
        respond(id, await host.manageSession(params.sessionId as string, request as SessionManagementRequest));
        return;
      }
}
