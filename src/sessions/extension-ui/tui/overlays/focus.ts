import type { UiContext, Overlay } from "../../ui-types.ts";
import { publish } from "../../publication/publish-revision.ts";

export function focus(ctx: UiContext, overlays: Map<string, Overlay>, overlay: Overlay) { if (!overlays.has(overlay.id) || overlay.hidden) return; for (const item of overlays.values()) item.focused = item.id === overlay.id; overlays.delete(overlay.id); overlays.set(overlay.id, overlay); publish(ctx); }
