import type { ChannelsContext } from "../channel-state.ts";
import type { TargetState } from "../channel-types.ts";

export function notify(ctx: ChannelsContext, listener: (state: TargetState) => void, state: TargetState): void {
  const { log } = ctx;
  try { listener(state); } catch { log("target channel state listener failed"); }
}
