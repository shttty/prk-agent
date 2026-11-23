import type { HostedExtensionsContext } from "../bind-extensions.ts";

export const waitForIdle = (ctx: HostedExtensionsContext) => ctx.session.waitForIdle();
