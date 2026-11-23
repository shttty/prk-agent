import { useAuiState } from "@assistant-ui/react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { isBusy } from "../conversation/is-busy.js";
import { activeOperation } from "../conversation/active-operation.js";
// Whether the selected session is working (store operation state or assistant-ui's running thread), and whether a
// stop was requested.
export function useBusy() {
  const runtimeRunning = useAuiState((value) => value.thread.isRunning);
  const busy = useWorkbench(isBusy) || runtimeRunning;
  const cancelling = useWorkbench((state) => Boolean(activeOperation(state)?.cancelRequested || state.session.snapshot?.state === "cancel_requested"));
  return { busy, cancelling };
}
