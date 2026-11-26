import type { PublicExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import type { TargetMap } from "../sidebar-types.ts";

export function targetMap(targets: readonly PublicExecutionTarget[]): TargetMap {
  return new Map(targets.map((target) => [target.id, target]));
}
