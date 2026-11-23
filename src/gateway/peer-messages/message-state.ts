import type { createAgentMessaging } from "../../sessions/peer-messaging/assemble-peer-messaging.ts";

export interface MessageState {
  messaging: ReturnType<typeof createAgentMessaging>;
}
