import { providerUnloadError } from "../../../plugins/package-load/provider-unload-error.ts";
import { unloadedPackageSources } from "../../../plugins/package-load/unloaded-package-sources.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { lazyLayers } from "./read-lazy-layers.ts";
import { sessionPackages } from "./list-session-packages.ts";

/** Sources of the packages this session's switch layers keep out; a provider package cannot be one of them. */
export function unloadedPackages(ctx: RuntimeContext): string[] {
  const packages = sessionPackages(ctx);
  const sources = unloadedPackageSources(packages, lazyLayers(ctx));
  const provider = packages.find((pkg) => pkg.providerIds.length && sources.includes(pkg.source));
  if (provider) throw providerUnloadError(provider);
  return sources;
}
