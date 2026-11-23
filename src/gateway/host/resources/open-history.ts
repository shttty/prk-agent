import { createSessionHistory } from "../../../sessions/history/assemble-history.ts";
import type { HostContext } from "../host-state.ts";
import type { HostState } from "../host-state.ts";

export function openHistory(ctx: HostContext): Promise<HostState["history"]> { return createSessionHistory({
    cwd: ctx.host.paths.home,
    directory: ctx.host.historyDirectory,
    limits: ctx.host.config.limits,
  }); }
