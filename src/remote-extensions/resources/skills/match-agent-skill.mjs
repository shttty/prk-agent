import { basename, dirname, relative } from "node:path";
import { matchSkillPattern } from "./match-skill-pattern.mjs";
import { matchExactSkill } from "./match-exact-skill.mjs";

export function enabledAgentSkill(path, patterns, baseDir) {
  const parent = dirname(path);
  const candidates = [relative(baseDir, path), basename(path), path];
  const exactCandidates = [relative(baseDir, path), path];
  if (basename(path) === "SKILL.md") {
    candidates.push(relative(baseDir, parent), basename(parent), parent);
    exactCandidates.push(relative(baseDir, parent), parent);
  }
  const match = (pattern) => matchSkillPattern(candidates, pattern);
  const exact = (pattern) => matchExactSkill(exactCandidates, pattern);
  // Pi package-manager's override precedence: !pattern, then +exact, then -exact.
  let enabled = !patterns.some((pattern) => pattern.startsWith("!") && match(pattern.slice(1)));
  if (patterns.some((pattern) => pattern.startsWith("+") && exact(pattern.slice(1)))) enabled = true;
  if (patterns.some((pattern) => pattern.startsWith("-") && exact(pattern.slice(1)))) enabled = false;
  return enabled;
}
