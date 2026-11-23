import { unsupported } from "../sdk-facade/reject-capability.mjs";

export function readTheme(ctx, owner) {
  ctx.assertLive(owner);
  ctx.warning("ui.theme (no public active-theme export)");
  return unsupported("ui.theme (no public active-theme export)");
}
