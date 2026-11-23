import type { BodyContext } from "../request-state.ts";
import { finish } from "./finish.ts";
import { HttpError } from "../create-error.ts";

export const onError = (ctx: BodyContext): void => finish(ctx, () => ctx.reject(new HttpError(400, "Request body could not be read.")));
