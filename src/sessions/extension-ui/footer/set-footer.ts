import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createTuiAdapter } from "../tui/assemble-tui.ts";
import { publish } from "../publication/publish-revision.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "../components/dispose-component.ts";

export function setFooter(ctx: UiContext, factory: Parameters<ExtensionUIContext["setFooter"]>[0]) {
      disposeComponent(ctx, ctx.state.footer); ctx.state.footer = undefined; clearInterval(ctx.branchTimer); ctx.branchTimer = undefined; ctx.branchListeners.clear();
      try { if (factory) ctx.state.footer = factory(createTuiAdapter(ctx, new Map()), requireTheme(ctx), ctx.footerData!); }
      finally { publish(ctx); }
    }
