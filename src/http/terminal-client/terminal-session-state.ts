import type { ClientContext } from "../gateway-connection/client-state.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";
import type { WebTerminalSink } from "../gateway-connection/client-types.ts";

export interface TerminalSessionContext {
  readonly owner: ClientContext;
  readonly client: GatewayClient;
  readonly sessionId: string;
  readonly name: string;
  readonly sink: WebTerminalSink;
  released: boolean;
  inFlightMax: number;
  inFlight: number;
  readonly queue: Array<{ method: "terminalInput"; data: string } | { method: "terminalResize"; rows: number; cols: number }>;
  stopEvents: (() => void) | undefined;
  stopLifecycle: (() => void) | undefined;
}
