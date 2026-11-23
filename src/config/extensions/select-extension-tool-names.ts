import type { ExtensionFilter, ExtensionWithTools } from "./extensions-options.ts";
import { isExtensionToolAllowedByFilter } from "./tool-selection/is-tool-allowed.ts";

/** Names admitted to Pi's tools allowlist; code sessions keep native exposure and hide declarations via kernel_code. */
export function selectExtensionToolNames(
  extensions: readonly ExtensionWithTools[],
  filter: ExtensionFilter | undefined,
  codeModeSession = false,
  discoveredNames: readonly string[] = [],
): string[] {
  const names = new Set<string>();
  for (const extension of extensions) {
    for (const { definition } of extension.tools.values()) {
      if ((!codeModeSession && definition.exposure === "codemode") || !isExtensionToolAllowedByFilter(definition.name, filter)) continue;
      names.add(definition.name);
    }
  }
  for (const name of discoveredNames) if (isExtensionToolAllowedByFilter(name, filter)) names.add(name);
  return [...names];
}
