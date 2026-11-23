import type { SessionOptions } from "../../config/session/session-options.ts";
import type { PeerMessage } from "../../../shared/session-messages/message-types.js";
import type { PeerDelivery } from "../../../shared/session-messages/message-types.js";
import type { PeerReceipt } from "../host/host-types.ts";
import type { AgentPeer } from "../../plugins/sessions/session-types.ts";
export interface AgentMessagingEnvironment {
  list(): readonly AgentPeer[];
  /** Append to the recipient-owned inbox; never await its running turn. */
  deliver(to: string, message: PeerMessage, delivery?: PeerDelivery): Promise<PeerReceipt>;
  canControl?(actor: string, target: string): boolean;
}

export interface MessagingContext {
  env: AgentMessagingEnvironment;
  sessionOptions: SessionOptions;
  noReply: Set<string>;
  answered: Set<string>;
  answeringNow: Set<string>;
}
