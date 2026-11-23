import type { RuntimeLink } from "../../runtime-link/link-types.ts";
import type { LinkWaiterContext } from "../channel-state.ts";
import { cleanup } from "./remove-link-waiter.ts";

export function resolve(ctx: LinkWaiterContext, link: RuntimeLink): void {
  cleanup(ctx); ctx.result.resolve(link);
}
