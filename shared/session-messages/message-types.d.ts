export type PeerDelivery = "steer" | "followUp" | "abort";

export interface PeerMessage {
  readonly label: string;
  readonly sender: string;
  readonly messageId: string;
  readonly replyTo: string;
  readonly expectReply: boolean;
  readonly body: string;
  /** Recipient host/stream-local transport order; assigned by receivePeer, never by the sender. */
  readonly arrival?: number;
  readonly batch?: { readonly id: string; readonly index: number; readonly count: number };
}
