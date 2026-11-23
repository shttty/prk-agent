import type { StreamContext } from "../observation-state.ts";
import { finishStream } from "../lifecycle/finish.ts";

export const endCollectionStream = (ctx: StreamContext) => finishStream(ctx);
