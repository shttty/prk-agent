import type { Extension, LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import type { InvocationContext, ExtensionOverride } from "./invocation-types.ts";
import { handlers } from "./handlers.ts";
import { tools } from "./tools.ts";
import { commands } from "./commands.ts";

export function override(ctx: InvocationContext, base: LoadExtensionsResult, previous?: ExtensionOverride): LoadExtensionsResult {
  const loaded = previous ? previous(base) : base;
  ctx.idle.abort(ctx.reason);
  ctx.idle = new AbortController();
  return {
    ...loaded,
    get errors() { return loaded.errors; },
    extensions: loaded.extensions.map((extension): Extension => {
      const projection: Extension = {
        ...extension,
        // Keep pi.on()/unsubscribe authoritative, including post-load registrations.
        get handlers() { return handlers(ctx, extension, projection); },
        // The loader assigns package metadata after this override. Late registrations
        // still use its original Extension, so project their metadata without editing it.
        get tools() { return tools(extension, projection); },
        get commands() { return commands(extension, projection); },
      };
      return projection;
    }),
  };
}
