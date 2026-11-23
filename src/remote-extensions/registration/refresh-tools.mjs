import { unsupported } from "../sdk-facade/reject-capability.mjs";

export function refreshTools(_ctx, owner) {
  if (owner.phase !== "loading") unsupported("dynamic registration after load");
}
