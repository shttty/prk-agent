import type { Socket } from "node:net";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";

export interface SessionSubscriptionContext {
  readonly socket: Socket;
  readonly limits: LimitsOptions;
  readonly sessionId: string;
  boundary: number | undefined;
  streamId: string | undefined;
  buffered: SessionHostEvent[];
  bytes: number;
}
