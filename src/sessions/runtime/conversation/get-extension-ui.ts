import type { HostedExtensionUI } from "../../extension-ui/ui-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function getExtensionUi(ctx: RuntimeContext): HostedExtensionUI { return ctx.active.extensionUi; }
