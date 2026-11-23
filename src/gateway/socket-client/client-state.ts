import type { Socket } from "node:net";
import type { GatewayOptions } from "../../config/gateway/gateway-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { HostEventListener, CollectionEventListener, TerminalEventListener } from "./client-types.ts";

export interface ClientContext {
  readonly socket: Socket;
  readonly gateway: GatewayOptions;
  readonly limits: LimitsOptions;
  readonly closed: ReturnType<typeof Promise.withResolvers<void>>;
  readonly pending: Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout }>;
  readonly listeners: Set<HostEventListener>;
  readonly collectionListeners: Set<CollectionEventListener>;
  readonly terminalListeners: Set<TerminalEventListener>;
  counter: number;
  lost: boolean;
}
