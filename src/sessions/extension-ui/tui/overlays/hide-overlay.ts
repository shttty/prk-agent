import type { UiContext, Overlay } from "../../ui-types.ts";
import { publish } from "../../publication/publish-revision.ts";
import { disposeComponent } from "../../components/dispose-component.ts";

export function hideOverlay(ctx: UiContext, overlays: Map<string, Overlay>) { const last = [...overlays.values()].at(-1); if (last) { overlays.delete(last.id); disposeComponent(ctx, last.component); publish(ctx); } }
