import type { JsonValue } from "@earendil-works/pi-ai";
import type { SessionsGateway } from "../gateway-types.ts";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
export function createSpaceStatusTool(gateway: Pick<SessionsGateway, "spaceStatus">) {
  return defineTool({
    name: "space_status",
    label: "Space status",
  description: "Read configured targets, sessions (root/supervisor), roles, and models with valid thinking levels offline.",
  parameters: Type.Object({ target: Type.Optional(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
  outputSchema: Type.Object({
    targets: Type.Array(Type.Object({ id: Type.String(), label: Type.String(), local: Type.Boolean(), tags: Type.Array(Type.String()), python: Type.Optional(Type.String()), configurationIssue: Type.Optional(Type.Object({ code: Type.String(), message: Type.String() }, { additionalProperties: false })) }, { additionalProperties: false })),
    sessions: Type.Array(Type.Object({
      name: Type.String(), target: Type.String(), label: Type.String(), cwd: Type.String(),
      state: Type.Union([Type.Literal("idle"), Type.Literal("starting"), Type.Literal("running"), Type.Literal("sleeping"), Type.Literal("unavailable"), Type.Literal("closing"), Type.Literal("closed")]),
      projectId: Type.Optional(Type.String()), projectName: Type.Optional(Type.String()),
      root: Type.Optional(Type.Literal(true)), supervisor: Type.Optional(Type.Literal(true)),
      sessionId: Type.Optional(Type.String()), history: Type.Optional(Type.Boolean()), requiresReload: Type.Optional(Type.Boolean()),
      startedAt: Type.Optional(Type.Number()), finishedAt: Type.Optional(Type.Number()), asking: Type.Optional(Type.Literal(true)),
    }, { additionalProperties: true, description: "Managed session snapshot, including its current kernel, derivation, recovery and monitoring data when available." })),
    models: Type.Array(Type.Object({ value: Type.String(), label: Type.String(), provider: Type.String(), thinkingLevels: Type.Array(Type.String()), contextWindow: Type.Number() }, { additionalProperties: false })),
    defaultModel: Type.String(), defaultThinkingLevel: Type.String(),
    roles: Type.Array(Type.Object({
      name: Type.String(), description: Type.Optional(Type.String()), model: Type.Optional(Type.String()), thinkingLevel: Type.Optional(Type.String()),
      toolMode: Type.Optional(Type.Union([Type.Literal("code"), Type.Literal("direct")])), isolated: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false })),
    derivationDefaults: Type.Object({
      toolMode: Type.Union([Type.Literal("code"), Type.Literal("direct")]), isolated: Type.Boolean(), maxDepth: Type.Integer({ minimum: 1, maximum: 10 }),
    }, { additionalProperties: false }),
    inheritance: Type.String(), target: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
  async execute(_id, params) {
   const result = await gateway.spaceStatus(params.target);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result as unknown as JsonValue, details: result };
    },
  });
}
