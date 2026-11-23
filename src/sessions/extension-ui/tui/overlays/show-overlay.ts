import type { UiContext, Overlay } from "../../ui-types.ts";
import type { Component, OverlayHandle, OverlayOptions } from "@earendil-works/pi-tui";
import { publish } from "../../publication/publish-revision.ts";
import { hideOverlayHandle } from "./hide.ts";
import { setHidden } from "./set-hidden.ts";
import { isHidden } from "./is-hidden.ts";
import { focus } from "./focus.ts";
import { unfocus } from "./unfocus.ts";
import { isFocused } from "./is-focused.ts";
import { getBounds } from "./get-bounds.ts";

export function showOverlay(ctx: UiContext, overlays: Map<string, Overlay>, component: Component, options?: OverlayOptions): OverlayHandle {
      const id = `overlay-${crypto.randomUUID()}`;
      const overlay: Overlay = { id, component, options, hidden: false, focused: !options?.nonCapturing };
      if (overlay.focused) for (const item of overlays.values()) item.focused = false;
      overlays.set(id, overlay);
      publish(ctx);
      return {
      hide: () => hideOverlayHandle(ctx, overlays, overlay),
      setHidden: (hidden) => setHidden(ctx, overlays, overlay, hidden),
      isHidden: () => isHidden(ctx, overlays, overlay),
      focus: () => focus(ctx, overlays, overlay),
      unfocus: (options) => unfocus(ctx, overlays, overlay, options),
      isFocused: () => isFocused(ctx, overlays, overlay),
      getBounds: () => getBounds(ctx, overlays, overlay),
    };
    }
