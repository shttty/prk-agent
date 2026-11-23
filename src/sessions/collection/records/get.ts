import type { SessionRuntime } from "../../runtime/runtime-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export function get(ctx: CollectionContext, sessionId: string): SessionRuntime | undefined {
      return ctx.records.get(sessionId)?.session;
    }
