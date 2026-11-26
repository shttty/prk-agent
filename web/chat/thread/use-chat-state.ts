import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { ChatState } from "./chat-state-types.ts";

/** `useWorkbench` for chat components: the selector sees the chat view of the workbench state. */
export function useChatState<T>(select: (state: ChatState) => T): T {
  return useWorkbench(select);
}
