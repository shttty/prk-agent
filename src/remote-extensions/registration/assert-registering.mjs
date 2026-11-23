import { unsupported } from "../sdk-facade/reject-capability.mjs";

export function registering(ctx, owner) {
  ctx.assertLive(owner);
  if (owner.phase !== "loading") unsupported("dynamic registration after load");
}
