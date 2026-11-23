import type { LoadContext, RemoteExtensionLoadInput } from "./load-types.ts";
import { inspect } from "./catalog/inspect.ts";
import { origin } from "./catalog/resolve-origin.ts";
import { close } from "./lifecycle/close.ts";

export function assembleSessionLoad(input: RemoteExtensionLoadInput): LoadContext {
  const ctx: LoadContext = {
    input, generations: [], statuses: [], tools: new Map(), localEntries: new Map(),
    managedErrors: new Map(), remotePackages: [], remoteStatuses: new Map(), projectEntries: new Map(),
    load: { paths: [], factories: [], inspect: (extensions, errors) => inspect(ctx, extensions, errors),
      get providerErrors() { return ctx.statuses.flatMap((status) => status.providerErrors ?? []); },
      origin: (tool) => origin(ctx, tool), close: () => close(ctx) },
  };
  return ctx;
}
