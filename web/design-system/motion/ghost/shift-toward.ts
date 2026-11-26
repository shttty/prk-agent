import type { MotionDistance, MotionEdge } from "../motion-types.ts";

const AXES: Record<MotionEdge, readonly [axis: string, sign: number]> = { left: ["translateX", -1], right: ["translateX", 1], up: ["translateY", -1], down: ["translateY", 1] };

/** The transform that moves something toward `edge` by a --pi-motion-* length token. */
export function shiftToward(edge: MotionEdge, distance: MotionDistance): string {
  const [axis, sign] = AXES[edge];
  return `${axis}(calc(${sign} * var(--pi-motion-${distance})))`;
}
