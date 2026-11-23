import type { Socket } from "node:net";
import { DEFAULT_GATEWAY_OPTIONS } from "../../config/gateway/gateway-options.ts";

export function endSocket(socket: Socket, closeGraceMs = DEFAULT_GATEWAY_OPTIONS.socketCloseGraceMs): void {
  if (socket.destroyed) return;
  socket.end();
  const timer = setTimeout(() => socket.destroy(), closeGraceMs);
  timer.unref();
  socket.once("close", () => clearTimeout(timer));
}
