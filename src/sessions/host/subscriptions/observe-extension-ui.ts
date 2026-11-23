import type { HostContext } from "../host-types.ts";
import { emit } from "./publish-event.ts";

export function observeExtensionUi(ctx: HostContext): void {
  emit(ctx, "extension_ui", { details: { extensionUi: ctx.options.extensionUi?.snapshot() } });
}
