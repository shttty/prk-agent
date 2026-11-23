import type { Socket } from "node:net";
import type { WireError } from "../wire/create-error.ts";
import type { ChannelContext } from "./channel-state.ts";
import { receiveChunk } from "./framing/receive-chunk.ts";

/** Byte-counted framing; incomplete UTF-8 is only decoded after a full frame. */
export function readFrames(socket: Socket, maxBytes: number, receive: (value: unknown) => void, invalid: (error: WireError) => void): void {
  const ctx: ChannelContext = {
    socket, maxBytes, receive, invalid,
    buffered: Buffer.alloc(0),
    failed: false,
    decoder: new TextDecoder("utf-8", { fatal: true }),
  };
  socket.on("data", (chunk: Buffer) => receiveChunk(ctx, chunk));
}
