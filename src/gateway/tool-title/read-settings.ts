import type { ToolTitleSettings } from "../../config/session/session-options.ts";
import type { HostContext } from "../host/host-state.ts";

export function toolTitleGet(ctx: HostContext): ToolTitleSettings {
  return { enabled: ctx.host.config.session.toolTitle };
}
