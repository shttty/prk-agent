import type { DeclarationInput, ToolDeclarations } from "./declaration-types.ts";
import { describeTools } from "./describe-tools.ts";
import { META_TOOL_NAMES } from "./meta-tool-names.ts";
import { KERNEL_CELL_TOOLS } from "../../plugins/kernel/register-cell-tools.ts";

export function projectDeclarations({ mode, tools }: DeclarationInput): ToolDeclarations {
  const enabled = tools.filter((tool) => tool.enabled && tool.exposure !== "hidden" && !Object.hasOwn(META_TOOL_NAMES, tool.name));
  const hidden = enabled.filter((tool) => !tool.native && (mode === "code"
    ? tool.name !== "kernel_code" && tool.name !== "kernel_language" && !Object.hasOwn(KERNEL_CELL_TOOLS, tool.name)
    : tool.lazy && tool.callable && tool.exposure !== "model-only"));
  const hiddenNames = new Set(hidden.map((tool) => tool.name));
  const declared = enabled.filter((tool) => !hiddenNames.has(tool.name)).map((tool) => tool.name);
  if (mode === "direct" && hidden.length) declared.push(...Object.keys(META_TOOL_NAMES));
  const listed = mode === "code" ? enabled.filter((tool) => tool.callable) : hidden;
  const guidelines = [...new Set(enabled.flatMap((tool) => tool.promptGuidelines ?? []))];
  return {
    declared,
    hidden,
    prompt: [
      ...(listed.length ? [mode === "code" ? "Currently callable Gateway tools:" : "Tools available on demand:", describeTools(listed)] : []),
      ...(mode === "direct" && hidden.length ? ["Use tool_search(query) to inspect a hidden tool's schema and guidelines, then tool_call(name, args) to execute it. Search and calls do not change tool declarations."] : []),
      ...guidelines,
    ].join("\n"),
  };
}
