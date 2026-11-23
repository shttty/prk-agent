import type { ClientContext } from "../gateway-connection/client-state.ts";
import type { WebObserverSink } from "../gateway-connection/client-types.ts";
import { acquireStream } from "../gateway-connection/acquire-stream.ts";
import type { ObservationContext } from "./observation-state.ts";
import { object } from "../../gateway/wire/is-record.ts";
import { releaseObservation } from "./release.ts";
import { subscribe } from "./subscribe.ts";

export async function observeStream(owner: ClientContext, sessionId: string | undefined, sink: WebObserverSink): Promise<() => void> {
    const client = await acquireStream(owner, sink);
    const ctx: ObservationContext = { owner, client, sessionId, sink, released: false, observedSessionId: undefined, observedStreamId: undefined, observedSequence: -1 };
    ;
    const stopEvents = ctx.sessionId === undefined ? ctx.client.onCollectionEvent((event) => ctx.sink.event(event))
      : ctx.client.onEvent((event, source) => {
        // The Gateway tags every frame; a foreign identity is never displayed.
        if (ctx.released || source !== ctx.sessionId || event.sessionId !== ctx.observedSessionId) return;
        const snapshot = event.details?.snapshot;
        if (event.type === "snapshot" && object(snapshot)) {
          if (snapshot.sessionId !== ctx.observedSessionId || snapshot.streamId !== event.streamId || !Number.isSafeInteger(snapshot.sequence)) return;
          ctx.observedStreamId = event.streamId;
          ctx.observedSequence = snapshot.sequence as number;
          ctx.sink.event(event);
        } else if (event.streamId === ctx.observedStreamId && event.sequence > ctx.observedSequence) {
          ctx.observedSequence = event.sequence;
          ctx.sink.event(event);
        }
      });
    const stopLifecycle = ctx.sessionId === undefined ? undefined : ctx.client.onCollectionEvent((event) => {
      if (ctx.released || event.sessionId !== ctx.sessionId) return;
      if (["session_closed", "session_archived"].includes(event.type)) {
        releaseObservation(ctx, "Gateway session route closed.");
      }
    });
    void ctx.client.closed.then(() => releaseObservation(ctx, ctx.sessionId === undefined ? "Gateway collection observation connection ended." : "Gateway observation connection ended."));
    try {
      if (ctx.sessionId === undefined) {
        const snapshot = await ctx.client.request("subscribeSessions", {});
        ctx.owner.reachable = true;
        ctx.sink.snapshot(snapshot);
      } else {
        ;
        await subscribe(ctx);
      }
    } catch (error: unknown) {
      stopEvents();
      stopLifecycle?.();
      releaseObservation(ctx, ctx.sessionId === undefined ? "Gateway collection observation failed." : "Gateway observation connection failed.");
      if (ctx.client.lost) ctx.owner.reachable = false;
      throw error;
    }
    return () => {
      stopEvents();
      stopLifecycle?.();
      releaseObservation(ctx, ctx.sessionId === undefined ? "Collection observation stopped by the web client." : "Observation stopped by the web client.");
    };
  }
