import type { PeerMessage } from "../../../../shared/session-messages/message-types.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import type { HostContext } from "../host-types.ts";
import { recordDiscard } from "./record-discarded-peer.ts";
import { emit } from "../subscriptions/publish-event.ts";

export function refused(ctx: HostContext, batch: readonly PeerMessage[], error: unknown): void {
  const reason = describeError(error, ctx.sessionOptions);
  recordDiscard(ctx, batch, reason, "never-delivered");
  emit(ctx, "session_event", { details: { sdkType: "peer_delivery_refused", reason, messageIds: batch.map((message) => message.messageId) } });
}
