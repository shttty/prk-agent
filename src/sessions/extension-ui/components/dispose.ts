import type { UiContext, CustomState, Overlay } from "../ui-types.ts";
import { disposeComponent } from "./dispose-component.ts";

export function disposeCustom(ctx: UiContext, owner: CustomState, overlays: Map<string, Overlay>): void { disposeComponent(ctx, owner.component); for (const overlay of overlays.values()) disposeComponent(ctx, overlay.component); overlays.clear(); }
