import type { StreamContext } from "../observation-state.ts";
import { responseEvent } from "../../responses/write-event.ts";

export const publishCollectionEvent = (ctx: StreamContext, value: unknown) => responseEvent(ctx.http, ctx.response, "collection", value);
