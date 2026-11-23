import type { SessionHostEvent } from "../../sessions/host/host-types.ts";
import type { GatewayCollectionEvent } from "../instance-environments/environment-types.ts";
import type { TerminalEvent } from "../../workspace/terminals/terminals-types.ts";
import type { connectGateway } from "./connect-client.ts";

type HostEventListener = (event: SessionHostEvent, sessionId: string) => void;
type CollectionEventListener = (event: GatewayCollectionEvent) => void;
type TerminalEventListener = (event: TerminalEvent, sessionId: string, name: string) => void;

export type { HostEventListener, CollectionEventListener, TerminalEventListener };
export type GatewayClient = Awaited<ReturnType<typeof connectGateway>>;
