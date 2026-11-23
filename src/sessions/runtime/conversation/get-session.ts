import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";

export function getSession(ctx: RuntimeContext): AgentSession { return ctx.active.session; }
