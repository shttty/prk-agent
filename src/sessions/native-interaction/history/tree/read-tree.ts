import type { LimitsOptions } from "../../../../config/limits/limits-options.ts";
import type { NativeTreeContext, NativeTarget } from "../../native-types.ts";
import { visit } from "./visit.ts";

export function treeProjection(target: NativeTarget, limits: LimitsOptions): readonly Record<string, unknown>[] {
  const ctx: NativeTreeContext = { limits, remaining: limits.nativeTreeNodes };
  return visit(ctx, target.manager.getTree(), 0);
}
