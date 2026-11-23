import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";
import { currentNotificationAnchor } from "./read-anchor.ts";

export function notify(ctx: UiContext, message: string, type: "info" | "warning" | "error" = "info"): void {
    const anchor = currentNotificationAnchor(ctx);
    const previous = ctx.state.notifications.at(-1);
    const entry = { id: String(++ctx.sequence), message, type, ...anchor, createdAt: Date.now() } as const;
    const coalesce = type === "info" && previous?.type === "info"
      && previous.sessionId === entry.sessionId && previous.anchorEntryId === entry.anchorEntryId && previous.position === entry.position;
    ctx.state.notifications = [...(coalesce ? ctx.state.notifications.slice(0, -1) : ctx.state.notifications), entry];
    publish(ctx);
  }
