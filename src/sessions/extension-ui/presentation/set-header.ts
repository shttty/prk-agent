import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createTuiAdapter } from "../tui/assemble-tui.ts";
import { publish } from "../publication/publish-revision.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "../components/dispose-component.ts";

export function setHeader(ctx: UiContext, factory: Parameters<ExtensionUIContext["setHeader"]>[0]) {
      disposeComponent(ctx, ctx.state.header); ctx.state.header = undefined;
      try { if (factory) ctx.state.header = factory(createTuiAdapter(ctx, new Map()), requireTheme(ctx)); }
      finally { publish(ctx); }
    }
