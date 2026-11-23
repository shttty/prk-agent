import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { SessionsGateway } from "../gateway-types.ts";
import { SESSION_MESSAGE_TOOL_METADATA } from "../message-metadata.ts";
import { response } from "./format-response.ts";

export function createMessagingTools(gateway: Pick<SessionsGateway, "schemas" | "sessionOptions" | "list" | "send">): ToolDefinition[] {
  const identity = gateway.schemas.identity;
  const fields = { sessionId: identity, sessionName: Type.String(), state: Type.String(), parentSessionId: Type.Union([identity, Type.Null()]) };
  const row = Type.Object({
    ...fields, pendingParentSessionId: Type.Optional(identity), self: Type.Optional(Type.Literal(true)),
    root: Type.Optional(Type.Literal(true)), supervisor: Type.Optional(Type.Literal(true)),
  }, { additionalProperties: false });
  const observation = Type.Object({
    ...fields,
    phase: Type.Optional(Type.Union([Type.Literal("working"), Type.Literal("submitted"), Type.Literal("delivered")])),
    role: Type.Optional(Type.String()), result: Type.Optional(gateway.schemas.resultSchema),
    recent: Type.Array(Type.Object({
      role: Type.Union([Type.Literal("user"), Type.Literal("assistant"), Type.Literal("toolResult")]),
      text: Type.String({ maxLength: 600 }), toolName: Type.Optional(Type.String()), isError: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false }), { maxItems: 20 }),
  }, { additionalProperties: false });
  return [
    defineTool({
      ...SESSION_MESSAGE_TOOL_METADATA.session_list,
      label: "列出会话",
      parameters: Type.Object({
        sessionId: Type.Optional(Type.String({ minLength: 1, maxLength: gateway.schemas.limits.identityChars, description: "Inspect one controlled session's status and recent output by sessionId. Omit to list all reachable sessions, including the caller (self: true)." })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, default: 6, description: "Max recent message/tool entries to return when sessionId is specified (default 6)." })),
      }, { additionalProperties: false }),
      outputSchema: Type.Union([Type.Array(row), observation]),
      async execute(_id, params) { return response(await gateway.list(params)); },
    }),
    defineTool({
      ...SESSION_MESSAGE_TOOL_METADATA.session_send,
      label: "发送同伴消息",
      parameters: Type.Object({
        to: Type.String({ minLength: 1, maxLength: gateway.schemas.limits.identityChars, description: "Recipient sessionId from session_spawn or session_list." }),
        message: Type.String({ minLength: 1, maxLength: gateway.sessionOptions.maxMessageChars }),
        delivery: Type.Optional(Type.Union([Type.Literal("steer"), Type.Literal("followUp"), Type.Literal("abort")], { default: "steer" })),
        replyTo: Type.Optional(Type.String({ minLength: 1, maxLength: gateway.schemas.limits.identityChars })),
        expectReply: Type.Optional(Type.Boolean({ description: `Whether the recipient should answer. Default: ${gateway.sessionOptions.expectReplyForNewMessages} for a new message, ${gateway.sessionOptions.expectReplyForReplies} for a reply (replyTo set).` })),
      }, { additionalProperties: false }),
      outputSchema: Type.Object({ id: Type.String(), to: Type.String(), accepted: Type.Literal(true), pending: Type.Integer({ minimum: 0 }), delivery: Type.Union([Type.Literal("delivered"), Type.Literal("queued")]), expectReply: Type.Boolean() }, { additionalProperties: false }),
      async execute(_id, params) { return response(await gateway.send(params)); },
    }),
  ];
}
