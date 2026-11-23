import type { StreamContext } from "../observation-state.ts";
import { responseEvent } from "../../responses/write-event.ts";

export const publishSessionEvent = (ctx: StreamContext, value: unknown) => responseEvent(ctx.http, ctx.response, "host", value);
