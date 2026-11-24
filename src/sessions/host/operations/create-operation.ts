import { randomUUID } from "node:crypto";
import type { HostContext, Operation, OperationKind } from "../host-types.ts";

export function createOperation(ctx: HostContext, kind?: OperationKind): Operation {
  return {
    id: `${ctx.sessionId}:${randomUUID()}`,
    ...(kind ? { kind } : {}),
    startedAt: Date.now(),
    messageCount: ctx.session.messages.length,
    requestIds: new Set(),
    completion: Promise.withResolvers(),
    pending: 0,
    cancelled: false,
    aborted: false,
    pythonStarted: false,
    unknown: false,
    returnedMessages: [],
  };
}
