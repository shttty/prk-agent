import type { Socket } from "node:net";
import type { WireError } from "../wire/create-error.ts";

export interface ChannelContext {
  readonly socket: Socket;
  readonly maxBytes: number;
  readonly receive: (value: unknown) => void;
  readonly invalid: (error: WireError) => void;
  buffered: Buffer;
  failed: boolean;
  readonly decoder: TextDecoder;
}
