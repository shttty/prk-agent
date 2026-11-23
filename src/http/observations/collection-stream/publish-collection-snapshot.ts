import type { StreamContext } from "../observation-state.ts";
import { responseSnapshot } from "../../responses/write-snapshot.ts";

export const publishCollectionSnapshot = (ctx: StreamContext, value: unknown) => responseSnapshot(ctx.http, ctx.response, value);
