import type { HostOperationSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";

export function activeOperation(ctx: StoreContext): HostOperationSnapshot | null { return ctx.state.session.snapshot?.operation || null; }
