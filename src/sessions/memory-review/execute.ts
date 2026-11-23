import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { JsonValue } from "@earendil-works/pi-ai";
import type { MEMORY_REQUEST_SCHEMA } from "../memory/memory-schema.ts";
import type { MemoryToolContext } from "./review-types.ts";

export async function execute(ctx: MemoryToolContext, ...[_id, request, signal]: Parameters<AgentTool<typeof MEMORY_REQUEST_SCHEMA>["execute"]>) {
  const { store, scope, saved } = ctx;
signal?.throwIfAborted();
  const result = store.apply(request, scope);
  await saved?.(result);
  const response = { usage: result.usage, message: result.message };
  return { content: [{ type: "text" as const, text: JSON.stringify(response) }], structuredContent: response as unknown as JsonValue, details: response };
}
