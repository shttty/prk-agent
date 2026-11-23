import { safeText } from "../../workbench/payloads/safe-text.js";
import { activeOperation } from "./active-operation.js";
export function isBusy(state) {
  return Boolean(activeOperation(state) || ["running", "cancel_requested"].includes(safeText(state?.session?.snapshot?.state)));
}
