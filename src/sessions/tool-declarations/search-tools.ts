import type { JsonValue } from "@earendil-works/pi-ai";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolDiscovery } from "./discovery-types.ts";
import { rankTools } from "./tool-rank/rank-tools.ts";

export function createToolSearch(discovery?: ToolDiscovery) {
  const parameters = Type.Object({ query: Type.String() }, { additionalProperties: false });
  return {
    name: "tool_search", label: "Search tools", exposure: "model-only",
    description: "Search hidden enabled tools by name or description and return their schemas.",
    parameters,
    outputSchema: Type.Object({ tools: Type.Array(Type.Object({
      name: Type.String(), description: Type.String(), parameters: Type.Object({}, { additionalProperties: true }),
      promptGuidelines: Type.Array(Type.String()),
    }, { additionalProperties: false })) }, { additionalProperties: false }),
    reachesTools: () => "all",
    prepareLoadout: discovery?.prepareLoadout,
    async execute(_id, { query }) {
      if (!discovery) throw new Error("tool_search is only available in a session runtime.");
      const enabled = new Set(discovery.inventory().filter((tool) => tool.enabled).map((tool) => tool.name));
      const matches = rankTools(discovery.declarations().hidden.filter((tool) => enabled.has(tool.name)), query);
      const tools = matches.map(({ name, description, parameters, promptGuidelines }) => ({ name, description, parameters, promptGuidelines: promptGuidelines ?? [] }));
      return { content: [{ type: "text", text: tools.length ? JSON.stringify({ tools }) : "No matching hidden tools." }], structuredContent: { tools } as unknown as JsonValue, details: {} };
    },
  } satisfies ToolDefinition<typeof parameters>;
}
