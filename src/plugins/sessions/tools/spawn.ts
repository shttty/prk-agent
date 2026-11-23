import { defineTool } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { DERIVED_TOOL_METADATA } from "../tool-metadata.ts";
import { response } from "./format-response.ts";
import type { SessionsGateway } from "../gateway-types.ts";

export function createSpawnTool(gateway: SessionsGateway): ToolDefinition {
  return defineTool({ ...DERIVED_TOOL_METADATA.session_spawn, label: "派生会话", parameters: gateway.schemas.spawnSchema, outputSchema: gateway.schemas.spawnResultSchema,
        async execute(_id, params) {
          const admitted = await gateway.spawn(params);
          return { ...response(admitted), ...(admitted.errors.length ? { isError: true } : {}) };
        } });
}
