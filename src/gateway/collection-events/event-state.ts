import type { GatewayCollectionEvent } from "../instance-environments/environment-types.ts";

export interface EventState {
  listeners: Set<(event: GatewayCollectionEvent) => void>;
  unsubscribeCollection: () => void;
}
