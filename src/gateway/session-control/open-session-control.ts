import { join } from "node:path";
import { readSessionControl } from "../../sessions/session-control/read-session-control.ts";
import type { HostContext } from "../host/host-state.ts";

export function openSessionControl(ctx: HostContext): void {
  ctx.control.path = join(ctx.host.paths.home, "session-control.json");
  ctx.control.value = readSessionControl(ctx.control.path);
  ctx.methods.refreshSessionControl();
}
