import type { HostContext } from "../../host/host-state.ts";
import type { SendStatus } from "../send-records/send-record-types.ts";
import { settleSendStatus } from "../send-records/settle-send-status.ts";

export function sendStatus(ctx: HostContext, sessionId: string, request: { readonly requestId: string; readonly streamId: string }): Promise<SendStatus> {
  return settleSendStatus(ctx.native.sendRecords, sessionId, request.requestId, request.streamId);
}
