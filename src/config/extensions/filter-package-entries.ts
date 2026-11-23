import type { ExtensionFilter } from "./extensions-options.ts";
import { packageSource } from "./package-selection/package-source.ts";
import { isPackageAllowedByExtensionFilter } from "./package-selection/is-package-allowed.ts";

/** Filter the Pi settings package entries before its resource loader resolves or imports them. */
export function filterPackageEntries<T>(packages: readonly T[] | undefined, filter: ExtensionFilter): T[] | undefined {
  if (packages === undefined) return undefined;
  return packages.filter((entry) => {
    const source = packageSource(entry);
    if (!source) return !filter.allow;
    return isPackageAllowedByExtensionFilter(source, filter);
  });
}
