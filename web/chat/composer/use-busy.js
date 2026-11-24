import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { isBusy } from "../conversation/is-busy.js";

// The assistant-ui thread mirrors this store; its previous render must not extend the Gateway's busy state.
export function useBusy() {
  const busy = useWorkbench(isBusy);
  const cancelling = useWorkbench((state) => state.session.snapshot?.state === "cancel_requested");
  return { busy, cancelling };
}
