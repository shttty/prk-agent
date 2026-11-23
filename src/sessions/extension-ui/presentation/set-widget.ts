import type { UiContext } from "../ui-types.ts";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createTuiAdapter } from "../tui/assemble-tui.ts";
import { publish } from "../publication/publish-revision.ts";
import { requireTheme } from "../theme/require-theme.ts";
import { disposeComponent } from "../components/dispose-component.ts";

export function setWidget(ctx: UiContext, key: Parameters<ExtensionUIContext["setWidget"]>[0], content: string[] | Parameters<ExtensionUIContext["setWidget"]>[1], options: Parameters<ExtensionUIContext["setWidget"]>[2]) {
      const placement = options?.placement ?? "aboveEditor";
      disposeComponent(ctx, ctx.state.widgets.get(key)?.component);
      ctx.state.widgets.delete(key);
      try {
        if (Array.isArray(content)) ctx.state.widgets.set(key, { placement, lines: [...content] });
        else if (content) ctx.state.widgets.set(key, { placement, component: content(createTuiAdapter(ctx, new Map()), requireTheme(ctx)) });
      } finally { publish(ctx); }
    }
