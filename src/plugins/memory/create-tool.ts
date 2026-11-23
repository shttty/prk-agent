import { defineTool } from "@earendil-works/pi-coding-agent";
import type { MemoryStore, MemoryResult } from "../../sessions/memory/memory-types.ts";
import type { MemoryScope } from "../../sessions/memory-review/review-types.ts";
import { createMemoryAgentTool } from "../../sessions/memory-review/create-agent-tool.ts";

export function createMemoryTool(store: MemoryStore, scope: MemoryScope, saved?: (result: MemoryResult) => void | Promise<void>) {
  return defineTool(createMemoryAgentTool(store, scope, saved));
}
