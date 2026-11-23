import { loadSkills, type LoadSkillsResult } from "@earendil-works/pi-coding-agent";

/** Keep Pi-discovered name collisions in Pi order until the current switch projection selects a winner. */
export function preserveGatewaySkillCandidates(base: LoadSkillsResult, cwd: string, agentDir: string): LoadSkillsResult {
  const paths = new Set(base.diagnostics.flatMap(({ collision }) => collision?.resourceType === "skill" ? [collision.loserPath] : []));
  const known = new Set(base.skills.map((skill) => skill.filePath));
  const candidates = [...paths].filter((path) => !known.has(path)).flatMap((path) => loadSkills({ cwd, agentDir, includeDefaults: false, skillPaths: [path] }).skills);
  return { ...base, skills: [...base.skills, ...candidates] };
}
