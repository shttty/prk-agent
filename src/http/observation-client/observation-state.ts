import type { ClientContext } from "../gateway-connection/client-state.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";
import type { WebObserverSink } from "../gateway-connection/client-types.ts";

export interface ObservationContext {
 readonly owner: ClientContext;
 readonly client: GatewayClient;
 readonly sessionId: string | undefined;
 readonly sink: WebObserverSink;
 released: boolean;
 observedSessionId: string | undefined;
 observedStreamId: string | undefined;
 observedSequence: number;
}
