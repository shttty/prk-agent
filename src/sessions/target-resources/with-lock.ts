import type { TargetSettingsContext } from "./resource-types.ts";

export function withLock(ctx: TargetSettingsContext, scope: keyof TargetSettingsContext, update: (current: string | undefined) => string | undefined): void {
  const next = update(ctx[scope]);
  if (next !== undefined) ctx[scope] = next;
}
