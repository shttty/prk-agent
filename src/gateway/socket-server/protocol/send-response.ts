import type { PeerContext } from "../connection/peer-state.ts";
import { WireError } from "../../wire/create-error.ts";
import { failure } from "../../wire/serialize-failure.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export function sendResponse(ctx: PeerContext, id: number, result: unknown): boolean {
  const { socket } = ctx;
  const { limits } = ctx.listener;
  const frame = { v: 1, id, ok: true, result };
  if (Buffer.byteLength(JSON.stringify(frame)) + 1 > limits.outputBytes) {
    writeFrame(socket, failure(id, new WireError("TOO_LARGE", "Result exceeds output limit; no partial snapshot is returned.")), limits.outputBytes, limits.outputBytes);
    return false;
  }
  return writeFrame(socket, frame, limits.outputBytes, limits.outputBytes);
}
