import type { CapabilityCtx } from "../capability-types.ts";

export function showPeek(ctx: Pick<CapabilityCtx, "setPeek" | "setPeekOpen">, next: NonNullable<CapabilityCtx["peek"]>) {
  const { setPeek, setPeekOpen } = ctx;
  setPeek(next); setPeekOpen(true);
}
