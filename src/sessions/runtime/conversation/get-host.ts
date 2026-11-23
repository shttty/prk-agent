import type { SessionHost } from "../../host/host-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function getHost(ctx: RuntimeContext): SessionHost { return ctx.active.host; }
