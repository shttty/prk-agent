const AXES = { left: ["translateX", -1], right: ["translateX", 1], up: ["translateY", -1], down: ["translateY", 1] };

/** The transform that moves something toward `edge` (left/right/up/down) by a --pi-motion-* length token. */
export function shiftToward(edge, distance) {
  const [axis, sign] = AXES[edge];
  return `${axis}(calc(${sign} * var(--pi-motion-${distance})))`;
}
