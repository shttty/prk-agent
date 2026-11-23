import { BACKGROUND_CONTEXT, withAbortSignal } from "@earendil-works/chord/context";

export function createTransferContext(signal: AbortSignal) {
  return withAbortSignal(signal, BACKGROUND_CONTEXT);
}
