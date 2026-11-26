import { useMemo } from "react";
import { useChatState } from "../thread/use-chat-state.ts";
import { askingSessions } from "./asking-sessions.ts";
import { useAskAlert } from "./use-ask-alert.ts";
/** Any session's waiting ask: tab title mark and (opt-in) notifications while the page is away. Renders nothing. */
export function AskAlert({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const sessions = useChatState((state) => state.sessions);
  const waiting = useMemo(() => askingSessions(sessions), [sessions]);
  useAskAlert(waiting, onOpen);
  return null;
}
