import type { HostedExtensionsContext } from "../bind-extensions.ts";

export function shutdownHandler(ctx: HostedExtensionsContext): void {
  void ctx.host.close().catch((error: unknown) => console.error("Hosted extension shutdown failed:", error));
}
