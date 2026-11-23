import type { HostedExtensionsContext } from "../bind-extensions.ts";

export const reload = (ctx: HostedExtensionsContext) => ctx.host.reload();
