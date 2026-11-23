import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DERIVED_TOOL_METADATA } from "../tool-metadata.ts";
import { response } from "./format-response.ts";
import type { SessionsGateway } from "../gateway-types.ts";

export function createManageTool(gateway: SessionsGateway) {
  const identity = gateway.schemas.identity;
  const parameters = Type.Union([
    Type.Object({ action: Type.Literal("destroy"), child: identity }, { additionalProperties: false }),
    Type.Object({ action: Type.Literal("transfer"), child: identity, to: identity }, { additionalProperties: false }),
    Type.Object({ action: Type.Literal("accept"), child: identity }, { additionalProperties: false }),
    Type.Object({ action: Type.Literal("project"), session: identity, project: Type.Union([Type.String({ minLength: 1, maxLength: gateway.schemas.limits.labelChars }), Type.Null()]) }, { additionalProperties: false }),
    Type.Object({ action: Type.Literal("supervisor"), session: identity }, { additionalProperties: false }),
  ]);
  return defineTool({ ...DERIVED_TOOL_METADATA.session_manage, label: "管理会话", parameters,
    outputSchema: Type.Object({}, { additionalProperties: true }),
    async execute(_id, input) {
      switch (input.action) {
        case "destroy": return response(await gateway.destroy(input.child));
        case "transfer": return response(await gateway.transfer(input.child, input.to));
        case "accept": return response(await gateway.accept(input.child));
        case "project": return response(gateway.setProject(input.session, input.project));
        case "supervisor": return response(gateway.setSupervisor(input.session));
      }
    },
  });
}
