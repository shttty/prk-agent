import { unsupported } from "./reject-capability.mjs";

export function rejectFacadeMutation(_ctx, label) {
  return unsupported(`${label} mutation`);
}
