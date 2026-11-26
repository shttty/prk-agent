import type { HostState } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";

export function hostState(ctx: StoreContext): HostState { return ctx.state.session.snapshot?.state || "idle"; }
