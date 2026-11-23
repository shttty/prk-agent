import { normalizePattern } from "./normalize-skill-pattern.mjs";

export function matchExactSkill(ctx, pattern) {
  return ctx.includes(normalizePattern(pattern.startsWith("./") || pattern.startsWith(".\\") ? pattern.slice(2) : pattern));
}
