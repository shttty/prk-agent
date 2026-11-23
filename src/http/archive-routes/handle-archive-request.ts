import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { routeArchivePath } from "./parse-archive-route.ts";
import { HttpError } from "../request/create-error.ts";
import { archiveRequest } from "./validate-archive-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { gatewayResponse } from "../responses/reply-with-gateway-result.ts";

export async function handleArchiveRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, archiveRoute: NonNullable<ReturnType<typeof routeArchivePath>>): Promise<void> {
  const { gateway, http } = ctx;

      if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
      archiveRequest(await readJsonBody(http, request), archiveRoute.action === "purge");
      await gatewayResponse(http, response, archiveRoute.action === "purge" ? "Archive group was not deleted." : "Archive group was not unarchived.", async () => {
        return archiveRoute.action === "purge"
          ? await gateway.call("purgeArchive", { group: archiveRoute.group, confirm: true })
          : await gateway.call("unarchive", { group: archiveRoute.group });
      });
      return;
    
}
