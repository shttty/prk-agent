import type { ExtensionFilter } from "../extensions-options.ts";
import { matchesPackageFilter } from "./matches-package-filter.ts";

export function isPackageAllowedByExtensionFilter(source: string, filter: ExtensionFilter): boolean {
  if (filter.allow && !filter.allow.packages.some((pattern) => matchesPackageFilter(pattern, source))) return false;
  return !filter.deny.packages.some((pattern) => matchesPackageFilter(pattern, source));
}
