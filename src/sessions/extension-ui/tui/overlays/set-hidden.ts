import type { UiContext, Overlay } from "../../ui-types.ts";
import type { OverlayHandle } from "@earendil-works/pi-tui";
import { publish } from "../../publication/publish-revision.ts";

export function setHidden(ctx: UiContext, overlays: Map<string, Overlay>, overlay: Overlay, hidden: Parameters<OverlayHandle["setHidden"]>[0]) { if (!overlays.has(overlay.id)) return; overlay.hidden = hidden; if (hidden) overlay.focused = false; publish(ctx); }
