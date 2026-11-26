import { useChatState } from "../thread/use-chat-state.ts";
import { isBusy } from "../conversation/is-busy.ts";

// The assistant-ui thread mirrors this store; its previous render must not extend the Gateway's busy state.
export function useBusy() {
  const busy = useChatState(isBusy);
  const cancelling = useChatState((state) => state.session.snapshot?.state === "cancel_requested");
  return { busy, cancelling };
}
