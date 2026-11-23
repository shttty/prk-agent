import type { ListenerContext } from "../listener-state.ts";
import { shutdownListener } from "./shutdown-listener.ts";

export function closeListener(ctx: ListenerContext): Promise<void> {
  return shutdownListener(ctx);
}
