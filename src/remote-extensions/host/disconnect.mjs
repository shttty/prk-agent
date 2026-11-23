import { shutdown } from "./shutdown.mjs";
import { asError } from "./normalize-error.mjs";

export function disconnect(ctx, error) {
  if (!ctx.connected) return;
  ctx.memoryTelemetry?.stop(false);
  ctx.connected = false;
  if (error) {
    console.error("[remote-extension host] transport failed:", asError(error));
    process.exitCode = 1;
  }
  ctx.socket.destroy();
  void shutdown(ctx, "quit").catch((failure) => console.error("[remote-extension host] disconnect cleanup:", failure));
}
