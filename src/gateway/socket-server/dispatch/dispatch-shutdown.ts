import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { failure } from "../../wire/serialize-failure.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";
import { shutdownListener } from "../lifecycle/shutdown-listener.ts";

export async function dispatchShutdown(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method } = request;
  const { limits } = ctx.listener;
  const { socket } = ctx;
      if (method === "shutdown") {
        await shutdownListener(ctx.listener, () => respond(id, { closed: true }), (error) => writeFrame(socket, failure(id, error), limits.outputBytes, limits.outputBytes));
      }
}
