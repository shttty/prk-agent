import type { UiContext, HostedCustomFactory, HostedCustomOptions, Overlay, CustomState } from "../ui-types.ts";
import { createTuiAdapter } from "../tui/assemble-tui.ts";
import { showOverlay } from "../tui/overlays/show-overlay.ts";
import { publish } from "../publication/publish-revision.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "./dispose-component.ts";
import { dispose } from "../lifecycle/dispose.ts";
import { disposeCustom } from "./dispose.ts";
import { doneCustom } from "./done.ts";
import { randomUUID } from "node:crypto";

export function custom<T>(ctx: UiContext, factory: HostedCustomFactory<T>, options?: HostedCustomOptions) {
      const manager = ctx.keybindings;
      const theme = requireTheme(ctx);
      ctx.custom?.done(undefined);
      const id = randomUUID();
      const overlays = new Map<string, Overlay>();
      let settled = false;
      return new Promise<T>((resolve, reject) => {
        const dispose = (): void => disposeCustom(ctx, owner, overlays);
        const done = (value: unknown): void => {
          if (settled) return;
          settled = true;
          doneCustom<T>(ctx, owner, value, resolve);
        };
        const owner: CustomState = { id, overlay: options?.overlay === true, options, overlays, done };
        ctx.custom = owner;
        const tui = createTuiAdapter(ctx, overlays);
        void Promise.resolve().then(() => settled ? undefined : factory(tui, theme, manager, done)).then((component) => {
          if (settled || ctx.custom !== owner || ctx.disposed) { disposeComponent(ctx, component); dispose(); return; }
          if (!component) return;
          owner.component = component;
          if (owner.overlay) {
            const overlayOptions = typeof options?.overlayOptions === "function" ? options.overlayOptions() : options?.overlayOptions;
            const handle = showOverlay(ctx, overlays, component, overlayOptions);
            owner.primary = [...overlays.values()].find((overlay) => overlay.component === component);
            options?.onHandle?.(handle);
          }
          publish(ctx);
        }).catch((error: unknown) => {
          if (settled) { dispose(); return; }
          settled = true; if (ctx.custom === owner) ctx.custom = undefined;
          dispose(); reject(error); publish(ctx);
        });
        publish(ctx);
      });
    }
