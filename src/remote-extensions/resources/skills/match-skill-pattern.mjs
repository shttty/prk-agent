import { createRequire } from "node:module";
import { normalizePattern } from "./normalize-skill-pattern.mjs";

// Use Pi's installed dependency and public API, including nested npm layouts.
const requirePi = createRequire(import.meta.resolve("@earendil-works/pi-coding-agent"));
const { minimatch } = requirePi("minimatch");

export function matchSkillPattern(ctx, pattern) {
  return ctx.some((candidate) => minimatch(candidate, normalizePattern(pattern)));
}
