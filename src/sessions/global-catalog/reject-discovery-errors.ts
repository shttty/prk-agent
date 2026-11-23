import type { CatalogContext } from "./catalog-types.ts";
import { CapabilityDiscoveryError } from "./discovery-error.ts";

export const rejectFailures = (ctx: CatalogContext): void => {
  if (ctx.failures.length) throw new CapabilityDiscoveryError(ctx.failures);
};
