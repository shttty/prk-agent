import type { UiContext, CustomState } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";
import { disposeCustom } from "./dispose.ts";

export function doneCustom<T>(ctx: UiContext, owner: CustomState, value: unknown, resolve: (value: T | PromiseLike<T>) => void): void {
if (ctx.custom === owner) ctx.custom = undefined;
disposeCustom(ctx, owner, owner.overlays);
resolve(value as T);
publish(ctx);
}
