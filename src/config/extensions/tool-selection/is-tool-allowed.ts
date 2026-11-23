import type { ExtensionFilter } from "../extensions-options.ts";

export function isExtensionToolAllowedByFilter(name: string, filter: ExtensionFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.allow && !filter.allow.tools.includes(name)) return false;
  return !filter.deny.tools.includes(name);
}
