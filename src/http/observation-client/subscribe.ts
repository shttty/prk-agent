import type { ObservationContext } from "./observation-state.ts";
import { object } from "../../gateway/wire/is-record.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export const subscribe = async (ctx: ObservationContext): Promise<void> => {
          const snapshot = await ctx.client.request("subscribe", { sessionId: ctx.sessionId! });
          if (ctx.released) return;
          if (!object(snapshot) || typeof snapshot.sessionId !== "string" || snapshot.sessionId !== ctx.sessionId || typeof snapshot.streamId !== "string" || !snapshot.streamId || !Number.isSafeInteger(snapshot.sequence)) {
            throw new WireError("CLIENT_ERROR", "Gateway observation snapshot is invalid.");
          }
          ctx.observedSessionId = snapshot.sessionId;
          ctx.observedStreamId = snapshot.streamId;
          ctx.observedSequence = snapshot.sequence as number;
          ctx.owner.reachable = true;
          ctx.sink.snapshot(snapshot);
        };
