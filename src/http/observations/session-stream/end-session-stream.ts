import type { StreamContext } from "../observation-state.ts";
import { finishStream } from "../lifecycle/finish.ts";

export const endSessionStream = (ctx: StreamContext) => finishStream(ctx);
