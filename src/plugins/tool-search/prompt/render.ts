import type { ToolDeclarations } from "../../../sessions/tool-declarations/declaration-types.ts";

export function renderToolCatalog(declarations: ToolDeclarations): string {
  return declarations.prompt;
}
