import type { ExtensionFilter } from "./extensions-options.ts";

/** The same package filter Pi's settings pass applies at startup, with these package sources added to its deny list. */
export function denyExtensionPackages(filter: ExtensionFilter | undefined, sources: readonly string[]): ExtensionFilter | undefined {
  if (!sources.length) return filter;
  return { ...filter, deny: { tools: filter?.deny.tools ?? [], packages: [...(filter?.deny.packages ?? []), ...sources] } };
}
