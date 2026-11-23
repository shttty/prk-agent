import type { ExtensionError } from "@earendil-works/pi-coding-agent";
import { EXTENSION_HANDLER_ABORT_MESSAGE } from "../../extension-invocation/invocation-constants.ts";
import type { HostedExtensionsContext } from "../bind-extensions.ts";

export function onError(ctx: HostedExtensionsContext, error: ExtensionError): void {
  if (error.error === EXTENSION_HANDLER_ABORT_MESSAGE) return;
  ctx.ui.context.notify(error.error, "error");
  if (error.event !== "provider_policy") console.error("Hosted extension reported an error:", error);
}
