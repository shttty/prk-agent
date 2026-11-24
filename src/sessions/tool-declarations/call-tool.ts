import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ToolDiscovery } from "./discovery-types.ts";

export function createToolCall(discovery?: ToolDiscovery) {
  const parameters = Type.Object({ name: Type.String(), args: Type.Object({}, { additionalProperties: true }) }, { additionalProperties: false });
  return {
    name: "tool_call", label: "Call hidden tool", exposure: "model-only",
    description: "Call an enabled hidden tool after tool_search (call declared tools directly).",
    parameters,
    reachesTools: (input) => typeof input.name === "string" ? [input.name] : [],
    async execute(_id, { name, args }, signal, onUpdate, context) {
      if (!discovery) throw new Error("tool_call is only available in a session runtime.");
      const tool = discovery.inventory().find((tool) => tool.name === name);
      if (!tool) throw new Error(`Tool ${name} does not exist.`);
      const declarations = discovery.declarations();
      if (tool.enabled && !declarations.hidden.some((tool) => tool.name === name)) throw new Error(`Tool ${name} is not hidden; call it directly.`);
      const outcome = await context.executeTool(name, args, { signal, onUpdate });
      return { ...outcome.result, isError: outcome.isError };
    },
  } satisfies ToolDefinition<typeof parameters>;
}
