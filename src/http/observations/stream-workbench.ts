import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { streamEvents } from "./stream-events.ts";

export async function streamWorkbench(ctx: RequestContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "GET") throw new HttpError(405, "Request method is not supported.");
  await streamEvents(ctx, undefined, response, "Live workbench updates could not be started; the Gateway did not accept a collection subscription.");
}
