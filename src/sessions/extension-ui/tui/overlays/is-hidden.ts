import type { UiContext, Overlay } from "../../ui-types.ts";

export function isHidden(ctx: UiContext, overlays: Map<string, Overlay>, overlay: Overlay) { return overlay.hidden || !overlays.has(overlay.id); }
