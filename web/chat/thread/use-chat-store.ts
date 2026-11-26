import { useContext } from "react";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import type { ChatState } from "./chat-state-types.ts";

export type ChatStore = { getSnapshot: () => ChatState };

/** The workbench store App provides. WorkbenchContext is still an untyped JavaScript module, so its value enters typed here. */
export function useChatStore(): ChatStore {
  const store: unknown = useContext(WorkbenchContext);
  return store as ChatStore;
}
