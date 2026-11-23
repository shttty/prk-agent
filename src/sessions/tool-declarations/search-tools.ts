import type { JsonValue } from "@earendil-works/pi-ai";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolDiscovery } from "./discovery-types.ts";
import type { DeclarationTool } from "./declaration-types.ts";

export function createToolSearch(discovery?: ToolDiscovery) {
  const parameters = Type.Object({ query: Type.String({ description: "Tool name substring or description keywords." }) }, { additionalProperties: false });
  return {
    name: "tool_search", label: "Search tools", exposure: "model-only",
    description: "Search hidden enabled tools by name or description; return their parameters and guidelines without changing declarations.",
    parameters,
    outputSchema: Type.Object({ tools: Type.Array(Type.Object({
      name: Type.String(), description: Type.String(), parameters: Type.Object({}, { additionalProperties: true }),
      promptGuidelines: Type.Array(Type.String()),
    }, { additionalProperties: false })) }, { additionalProperties: false }),
    reachesTools: () => "all",
    prepareLoadout: discovery?.prepareLoadout,
    async execute(_id, { query }) {
      if (!discovery) throw new Error("tool_search is only available in a session runtime.");
      const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
      const enabled = new Set(discovery.inventory().filter((tool) => tool.enabled).map((tool) => tool.name));
      const matches: { tool: DeclarationTool; hits: number; nameHits: number }[] = [];
      for (const tool of discovery.declarations().hidden) {
        if (!enabled.has(tool.name)) continue;
        const name = tool.name.toLowerCase();
        const description = tool.description.toLowerCase();
        let hits = 0;
        let nameHits = 0;
        for (const term of terms) {
          const inName = name.includes(term);
          if (inName) nameHits++;
          if (inName || description.includes(term)) hits++;
        }
        if (hits) matches.push({ tool, hits, nameHits });
      }
      matches.sort((a, b) => b.hits - a.hits || b.nameHits - a.nameHits);
      const tools = matches.map(({ tool: { name, description, parameters, promptGuidelines } }) => ({ name, description, parameters, promptGuidelines: promptGuidelines ?? [] }));
      return { content: [{ type: "text", text: tools.length ? JSON.stringify({ tools }) : "No matching hidden tools." }], structuredContent: { tools } as unknown as JsonValue, details: {} };
    },
  } satisfies ToolDefinition<typeof parameters>;
}
