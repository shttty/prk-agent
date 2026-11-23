import type { HostContext } from "../host-types.ts";

export function isIdle(ctx: HostContext): boolean { return ctx.state === "idle" && !ctx.active && !ctx.closing && !ctx.reloading && !ctx.flushingInbox && ctx.inbox.length === 0 && ctx.lifecycleTasks.size === 0; }
