import { defineTool } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DERIVED_TOOL_METADATA } from "../tool-metadata.ts";
import { response } from "./format-response.ts";
import type { SessionsGateway } from "../gateway-types.ts";

export function createResultTool(gateway: SessionsGateway): ToolDefinition {
  return defineTool({ ...DERIVED_TOOL_METADATA.session_result, label: "提交任务结果",
        parameters: Type.Object({ summary: gateway.schemas.resultSchema.properties.summary, artifacts: Type.Optional({ ...gateway.schemas.resultSchema.properties.artifacts, maxItems: gateway.schemas.limits.derivedArtifactsMax }), output: gateway.schemas.resultSchema.properties.output }, { additionalProperties: false }),
        outputSchema: Type.Object({ resultId: gateway.schemas.identity, phase: gateway.schemas.infoSchema.properties.phase, patch: gateway.schemas.resultSchema.properties.patch }, { additionalProperties: false }),
        async execute(_id, params) {
          const result = await gateway.submit(params.summary, params.artifacts ?? [], params.output);
          return { ...response(result), terminate: true };
        } });
}
