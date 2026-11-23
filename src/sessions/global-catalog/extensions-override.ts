import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import type { CatalogContext } from "./catalog-types.ts";

export const extensionsOverride = (ctx: CatalogContext, base: LoadExtensionsResult) => ctx.extensionHandlers.override(base);
