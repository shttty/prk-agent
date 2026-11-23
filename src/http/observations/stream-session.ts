import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { streamEvents } from "./stream-events.ts";

export async function streamSession(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string): Promise<void> {
  await streamEvents(ctx, sessionId, response, "Live observation could not be started; the Gateway did not accept a subscription.");
}
