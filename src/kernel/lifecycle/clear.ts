import type { KernelContext } from "../kernel-state.ts";
import { maintain } from "./maintain.ts";

export function clear(ctx: KernelContext) {
  return maintain(ctx, { kind: "clear" });
}
