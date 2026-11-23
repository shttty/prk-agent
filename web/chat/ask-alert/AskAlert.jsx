import { useMemo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { askingSessions } from "./asking-sessions.js";
import { useAskAlert } from "./use-ask-alert.js";
/** Any session's waiting ask: tab title mark and (opt-in) notifications while the page is away. Renders nothing. */
export function AskAlert({ onOpen }) {
  const sessions = useWorkbench((state) => state.sessions);
  const waiting = useMemo(() => askingSessions(sessions), [sessions]);
  useAskAlert(waiting, onOpen);
  return null;
}
