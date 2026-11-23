import type { Socket } from "node:net";
import { object } from "../wire/is-record.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";

export function writeFrame(socket: Socket, value: unknown, maxBytes = DEFAULT_LIMITS_OPTIONS.outputBytes, maxBufferedBytes = DEFAULT_LIMITS_OPTIONS.outputBytes): boolean {
  if (socket.destroyed || socket.writableEnded) return false;
  const frame = JSON.stringify(value) + "\n";
  const size = Buffer.byteLength(frame);
  const buffered = socket.writableLength;
  if (size > maxBytes || buffered + size > maxBufferedBytes) {
    const envelope = object(value) ? value : {};
    const event = [envelope.event, envelope.collection, envelope.terminal].find(object);
    const type = event?.type ?? envelope.method ?? envelope.kind ?? ("ok" in envelope ? "response" : "unknown");
    const params = object(envelope.params) ? envelope.params : undefined;
    const result = object(envelope.result) ? envelope.result : undefined;
    const sessionId = envelope.sessionId ?? event?.sessionId ?? params?.sessionId ?? result?.sessionId;
    const reason = size > maxBytes ? "frame exceeds byte limit" : "socket write backlog exceeds byte limit";
    console.error(`[${new Date().toISOString()}] Gateway ${reason}; closing peer`, JSON.stringify({ type, sessionId: sessionId ?? null, size, buffered, maxBytes, maxBufferedBytes }));
    socket.destroy(); return false;
  }
  socket.write(frame);
  return true;
}
