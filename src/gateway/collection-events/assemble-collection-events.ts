import { publish } from "./publish-lifecycle-event.ts";
import { subscribeSessions } from "./subscribe-collection.ts";
import type { HostContext } from "../host/host-state.ts";
import type { CollectionEventsMethods } from "./collection-events-methods.ts";

export function assembleCollectionEvents(ctx: HostContext): CollectionEventsMethods {
  return {
    publish: publish.bind(undefined, ctx),
    subscribeSessions: subscribeSessions.bind(undefined, ctx),
  };
}
