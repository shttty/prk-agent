import type { UiContext, Overlay } from "../../ui-types.ts";
import type { OverlayHandle } from "@earendil-works/pi-tui";
import { publish } from "../../publication/publish-revision.ts";

export function unfocus(ctx: UiContext, overlays: Map<string, Overlay>, overlay: Overlay, options: Parameters<OverlayHandle["unfocus"]>[0]) {
          for (const item of overlays.values()) item.focused = false;
          const target = options?.target;
          const next = target === null ? undefined : [...overlays.values()].reverse().find((item) => item !== overlay && !item.hidden && (target ? item.component === target : !item.options?.nonCapturing));
          if (next) next.focused = true;
          publish(ctx);
        }
