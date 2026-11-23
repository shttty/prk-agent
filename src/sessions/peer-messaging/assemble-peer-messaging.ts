import { DEFAULT_SESSION_OPTIONS, type SessionOptions } from "../../config/session/session-options.ts";
import type { AgentMessagingEnvironment, MessagingContext } from "./message-types.ts";
import type { SessionSendRequest } from "../../plugins/sessions/session-types.ts";
import { send } from "./send-message.ts";

export function createAgentMessaging(env: AgentMessagingEnvironment, sessionOptions: SessionOptions = DEFAULT_SESSION_OPTIONS) {
  // Acknowledgement ping-pong brake: a reply expects no answer unless its sender asks for one, and the
  // Gateway refuses replies to such messages. Lost on Gateway restart; worst case is one extra message.
  const noReply = new Set<string>();
  const answered = new Set<string>();
  // Only live reply admissions are reserved here; failed admissions release their association.
  const answeringNow = new Set<string>();
  const ctx: MessagingContext = { env, sessionOptions, noReply, answered, answeringNow };
  return {
    list: () => env.list(),
    send: (actor: string, request: SessionSendRequest) => send(ctx, actor, request.to, request.message, request.replyTo, request.expectReply, request.delivery),
  };
}
