import type { DeclarationTool } from "./declaration-types.ts";

export function describeTools(tools: readonly Pick<DeclarationTool, "name" | "description" | "promptSnippet">[]): string {
  return tools.map((tool) => {
    const summary = tool.promptSnippet?.trim() || tool.description.trim().split(/(?<=[.!?])\s|(?<=[。！？])/u, 1)[0];
    return `${tool.name}: ${summary.replace(/\s+/gu, " ")}`;
  }).join("\n");
}
