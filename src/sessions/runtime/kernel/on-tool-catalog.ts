import { cacheKernelToolCatalog } from "../../../codemode/module-catalog/cache-catalog.ts";
import { actualCapabilityCatalog } from "../capabilities/get-actual-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { KernelHelper } from "../../../codemode/module-catalog/catalog-types.ts";

export function onToolCatalog(ctx: RuntimeContext, catalog: KernelHelper[]) {
      ctx.helpers = catalog;
      cacheKernelToolCatalog(ctx.moduleHome, ctx.target.id, catalog);
      ctx.dependencies.onCapabilityCatalog?.(actualCapabilityCatalog(ctx));
    }
