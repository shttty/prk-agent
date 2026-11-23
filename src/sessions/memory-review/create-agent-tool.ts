import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { MEMORY_REQUEST_SCHEMA, targetSchema } from "../memory/memory-schema.ts";
import type { MemoryResult, MemoryStore } from "../memory/memory-types.ts";
import { MEMORY_TOOL_NAME, describeMemoryTool } from "../../plugins/memory/tool-metadata.ts";
import type { MemoryScope } from "./review-types.ts";
import { execute } from "./execute.ts";

export function createMemoryAgentTool(store: MemoryStore, scope: MemoryScope, saved?: (result: MemoryResult) => void | Promise<void>): AgentTool<typeof MEMORY_REQUEST_SCHEMA> {
  const ctx = { store, scope, saved };
  let layers;
  try { layers = store.settings().layers; } catch { layers = undefined; }
  return {
    name: MEMORY_TOOL_NAME, label: "Memory",
    // Review sees only the layers it may write.
    description: describeMemoryTool(scope.source === "review" ? layers?.filter((layer) => layer.review) : layers),
    parameters: MEMORY_REQUEST_SCHEMA,
    outputSchema: Type.Object({
      usage: Type.Array(Type.Object({ target: targetSchema, instance: Type.Optional(Type.String()), project: Type.Optional(Type.String()), chars: Type.Integer({ minimum: 0 }), limit: Type.Integer({ minimum: 0 }), soft: Type.Boolean(), overLimit: Type.Boolean() }, { additionalProperties: false })),
      message: Type.String(),
    }, { additionalProperties: false }),
    executionMode: "sequential",
    execute: (...args) => execute(ctx, ...args),
  };
}
