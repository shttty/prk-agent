import type { TargetState } from "../channels/channel-types.ts";
import type { LeaseContext } from "./lease-state.ts";

export const state = (ctx: LeaseContext): TargetState => ctx.lease.abort.signal.aborted ? { state: "stopped" } : ctx.snapshot(ctx.target);
