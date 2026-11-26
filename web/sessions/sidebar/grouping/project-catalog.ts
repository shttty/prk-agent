import type { ProjectPayload } from "../sidebar-types.ts";

/** The distinct projects named by `rows`, by name. */
export function projectCatalog(rows: readonly { projectId?: string; projectName?: string }[]): ProjectPayload[] {
  const projects = new Map<string, ProjectPayload>();
  for (const sessionRow of rows) {
    const id = sessionRow.projectId?.trim();
    const name = sessionRow.projectName?.trim();
    if (id && name && !projects.has(id)) projects.set(id, { id, name });
  }
  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
