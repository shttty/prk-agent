import type { ClientContext } from "../client-state.ts";
import { WireError } from "../../wire/create-error.ts";

export function openSocket(ctx: ClientContext): Promise<void> {
  const { socket, gateway } = ctx;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { socket.destroy(); reject(new WireError("CLIENT_ERROR","Gateway connection timed out; no local Agent was started.")); }, gateway.connectTimeoutMs);
    const failed = () => { clearTimeout(timer); reject(new WireError("CLIENT_ERROR","Gateway attach failed; no local Agent was started.")); };
    socket.once("error", failed);
    socket.once("connect", () => { clearTimeout(timer); socket.removeListener("error", failed); resolve(); });
  });
}
