import type { UiContext, Overlay } from "../../ui-types.ts";
import type { TUI } from "@earendil-works/pi-tui";
import { publish } from "../../publication/publish-revision.ts";

export function setFocus(ctx: UiContext, overlays: Map<string, Overlay>, component: Parameters<TUI["setFocus"]>[0]) { for (const overlay of overlays.values()) overlay.focused = overlay.component === component && !overlay.hidden; publish(ctx); }
