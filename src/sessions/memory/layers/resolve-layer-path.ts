import type { LayerScope, LayerSpec } from "./layer-types.ts";

/**
 * The layer's file for this session, or undefined when the session lacks a value the path needs (no project).
 * Scope values become one path segment: no separators, control characters, "." or "..".
 */
export function resolveLayerPath(layer: LayerSpec, scope: LayerScope): string | undefined {
  const needsProject = layer.path.includes("{project}");
  if (needsProject && scope.project === undefined) return undefined;
  if (layer.path.includes("{instance}")) segment("instance", scope.instance);
  if (needsProject) segment("project", scope.project!);
  return layer.path.replaceAll("{instance}", scope.instance).replaceAll("{project}", scope.project ?? "");
}

function segment(name: string, value: string): void {
  if (!value.trim() || value === "." || value === ".." || /[\\/\p{Cc}]/u.test(value)) {
    throw new Error(`Memory ${name} "${value}" must be one path segment without separators or control characters.`);
  }
}
