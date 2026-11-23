import type { BodyContext } from "../request-state.ts";
import { finish } from "./finish.ts";
import { HttpError } from "../create-error.ts";

export const onAborted = (ctx: BodyContext): void => finish(ctx, () => ctx.reject(new HttpError(400, "Request connection was aborted.")));
