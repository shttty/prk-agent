import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createToolSearch } from "../../sessions/tool-declarations/search-tools.ts";
import { createToolCall } from "../../sessions/tool-declarations/call-tool.ts";
import type { ToolDiscovery } from "../../sessions/tool-declarations/discovery-types.ts";

export function createDiscoveryTools(discovery?: ToolDiscovery): ToolDefinition[] {
  return [createToolSearch(discovery), createToolCall(discovery)];
}
