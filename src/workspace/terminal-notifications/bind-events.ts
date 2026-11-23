import type { ModelTerminals } from "../model-terminals/model-terminals-types.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TerminalEventBinding } from "./notification-types.ts";
import type { NotificationContext } from "./notification-state.ts";
import { disposeNotifications } from "./dispose.ts";

/** Only a two-second presentation batch; SDK owns turn delivery, steering and history. */
export function bindTerminalEvents(pi: ExtensionAPI, terminals: ModelTerminals): TerminalEventBinding {
  const ctx: NotificationContext = { pending: [], timer: undefined };
  const unsubscribe = terminals.subscribe((event) => {
    ctx.pending.push(event);
    ctx.timer ??= setTimeout(() => {
      ctx.timer = undefined;
      const events = ctx.pending;
      ctx.pending = [];
      pi.sendMessage({ customType: "terminal-event", content: JSON.stringify({ events }), display: true, details: { events } }, { triggerTurn: true, deliverAs: "steer" });
    }, 2000);
    ctx.timer.unref();
  });
  return {
    get pending() { return ctx.pending.length > 0; },
    dispose() { disposeNotifications(ctx, unsubscribe); },
  };
}
