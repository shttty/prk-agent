import type { UiContext, Overlay } from "../../ui-types.ts";
import { publish } from "../../publication/publish-revision.ts";
import { disposeComponent } from "../../components/dispose-component.ts";

export function hideOverlayHandle(ctx: UiContext, overlays: Map<string, Overlay>, overlay: Overlay) { if (!overlays.delete(overlay.id)) return; disposeComponent(ctx, overlay.component); publish(ctx); }
