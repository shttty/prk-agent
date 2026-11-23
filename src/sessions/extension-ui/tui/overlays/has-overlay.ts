import type { UiContext, Overlay } from "../../ui-types.ts";

export function hasOverlay(ctx: UiContext, overlays: Map<string, Overlay>) { return overlays.size > 0; }
