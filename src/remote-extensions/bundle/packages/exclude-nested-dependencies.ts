import { relative, sep } from "node:path";

export function excludeNestedDependencies(path: string, source: string): boolean {
  return source === path || relative(path, source).split(sep)[0] !== "node_modules";
}
