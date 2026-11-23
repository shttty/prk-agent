import type { Server, Socket } from "node:net";
import type { Connection, RemoteInfo } from "@earendil-works/pi-env";
import type { TargetConnectionInput, TargetEnvironmentOptions } from "./connection-types.ts";

export interface EnvironmentRecord {
  readonly id: string;
  readonly input: TargetConnectionInput;
  readonly generation: string;
  readonly abort: AbortController;
  readonly sockets: Set<Socket>;
  readonly exited: PromiseWithResolvers<void>;
  consumers: number;
  connection: Connection;
  server: Server;
  directory: string;
  ready: Promise<RemoteInfo>;
  closing?: Promise<void>;
  failure?: Error;
}
export interface EnvironmentsContext {
  readonly options: TargetEnvironmentOptions;
  readonly records: Map<string, EnvironmentRecord>;
}
