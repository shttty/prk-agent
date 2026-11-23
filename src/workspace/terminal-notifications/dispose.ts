import type { NotificationContext } from "./notification-state.ts";

export function disposeNotifications(ctx: NotificationContext, unsubscribe: () => void): void { unsubscribe(); clearTimeout(ctx.timer); ctx.timer = undefined; ctx.pending = []; }
