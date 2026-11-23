import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ToolLibraryRegistrationContext } from "../registration-types.ts";
import { savedToolMetadata } from "../../../codemode/tool-library/describe-saved-tool.ts";
import { executionSchema } from "./execution-schema.ts";
import { executeSavedTool } from "./execute-saved-tool.ts";

export function refresh(ctx: ToolLibraryRegistrationContext): void {
  const { library, target, known, pi } = ctx;
  if (ctx.refreshing) return;
  ctx.refreshing = true;
  try {
    const entries = library.list(target).filter((entry) => entry.status !== "archived" && entry.available !== false);
    const live = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      const name = entry.name;
      const definition: ToolDefinition<typeof executionSchema> = {
        ...savedToolMetadata(entry), label: name, exposure: "codemode",
        parameters: executionSchema, executionMode: "sequential",
        execute: executeSavedTool.bind(undefined, ctx, name),
      };
      const previous = known.get(entry.name);
      if (!previous || previous.description !== definition.description || previous.exposure !== definition.exposure) { pi.registerTool(definition); known.set(entry.name, definition); }
    }
    for (const [name, definition] of known) if (!live.has(name) && definition.exposure !== "hidden") {
      const hidden = { ...definition, exposure: "hidden" as const }; pi.registerTool(hidden); known.set(name, hidden);
    }
  } finally { ctx.refreshing = false; }
}
