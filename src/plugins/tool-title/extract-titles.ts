import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { TITLE_FIELD } from "./title-field.ts";

/**
 * Moves each call's title argument onto its toolcall block, before Pi validates the arguments.
 * Calls to tools that declare the field themselves keep it. Returns undefined when nothing changed.
 */
export function extractTitles(message: AgentMessage, ownsField: (toolName: string) => boolean): AgentMessage | undefined {
  if (message.role !== "assistant") return undefined;
  let changed = false;
  const content = message.content.map((block) => {
    if (block.type !== "toolCall" || !Object.hasOwn(block.arguments, TITLE_FIELD) || ownsField(block.name)) return block;
    changed = true;
    const { [TITLE_FIELD]: value, ...rest } = block.arguments;
    const title = typeof value === "string" ? value.trim() : "";
    return { ...block, arguments: rest, ...(title ? { [TITLE_FIELD]: title } : {}) };
  });
  return changed ? { ...message, content } : undefined;
}
