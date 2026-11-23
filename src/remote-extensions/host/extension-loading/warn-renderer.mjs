import { assertLive } from "../assert-live.mjs";

export function ignoredRenderer(ctx, owner, member, ..._args) {
  assertLive(ctx, owner);
  ctx.warning(`pi.${member}`);
}
