import { entryPackageSource } from "../../../plugins/package-load/find-entry-package.ts";
import { unloadedPackageSources } from "../../../plugins/package-load/unloaded-package-sources.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { lazyLayers } from "./read-lazy-layers.ts";
import { sessionPackages } from "./list-session-packages.ts";

/** Whether a catalog group belongs to a package that the load switches keep out of this session. */
export function packageUnloadedGroup(ctx: RuntimeContext): (group: string) => boolean {
  const packages = sessionPackages(ctx);
  const sources = unloadedPackageSources(packages, lazyLayers(ctx));
  return (group) => {
    const source = entryPackageSource(group, packages);
    return source !== undefined && sources.includes(source);
  };
}
