export function renderSkillTools(options: { autoSkills: boolean; instance: string; projectId?(): string | undefined }, callable: readonly string[]): string {
  return [
    ...(callable.includes("skill_manage") && options.autoSkills ? [`skill = procedures, judgment, pitfalls and user preferences/corrections for a class of task, not every session; inspect advertised skills, patch similar ones with skill_manage section/value, and cite concrete evidence. Judge portability: use instance:${options.instance} for this machine's paths/services/hosts, ${options.projectId?.() ? `project:${options.projectId()}` : "project:<projectId> only when the session belongs to that PRK project"} for project-only knowledge, and global only for genuinely portable knowledge.`] : []),
  ].join("\n");
}
