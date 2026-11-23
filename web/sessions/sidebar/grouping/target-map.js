
export function targetMap(targets) {
  return new Map(targets.map((target) => [target.id, target]));
}
