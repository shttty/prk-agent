import { text } from "../text.js";
export function projectCatalog(rows) {
  const projects = new Map();
  for (const sessionRow of rows) {
    const id = text(sessionRow.projectId).trim();
    const name = text(sessionRow.projectName).trim();
    if (id && name && !projects.has(id)) projects.set(id, { id, name });
  }
  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
